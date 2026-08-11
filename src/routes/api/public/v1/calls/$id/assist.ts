import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import {
  ASSIST_DROP_AFTER_MS,
  ASSIST_LATENCY_BUDGET_MS,
  matchPlaybooks,
  looksLikeQuestion,
  type PlaybookTrigger,
} from "@/lib/core/assist.server";
import { embed } from "@/lib/core/embeddings.server";

const utteranceSchema = z.object({
  workspace_id: z.string().uuid(),
  text: z.string().min(1).max(2000),
});

async function loadSession(db: Awaited<ReturnType<typeof getAdmin>>, id: string) {
  const { data } = await db
    .from("call_sessions")
    .select("id, workspace_id, status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export const Route = createFileRoute("/api/public/v1/calls/$id/assist")({
  server: {
    handlers: {
      /** SSE stream of surfaced suggestions for this call. */
      GET: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        const session = await loadSession(db, params["id"] as string);
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, session.workspace_id as string)))
          return apiError("forbidden", 403);

        const encoder = new TextEncoder();
        let since = new Date().toISOString();
        let closed = false;
        request.signal?.addEventListener("abort", () => {
          closed = true;
        });

        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) =>
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            send("ready", { call_session_id: session.id, budget_ms: ASSIST_LATENCY_BUDGET_MS });

            const deadline = Date.now() + 10 * 60 * 1000;
            while (!closed && Date.now() < deadline) {
              const { data: rows } = await db
                .from("assist_events")
                .select("*")
                .eq("call_session_id", session.id)
                .eq("surfaced", true)
                .gt("created_at", since)
                .order("created_at", { ascending: true });
              for (const row of rows ?? []) {
                since = row.created_at as string;
                // Never deliver late: a stale suggestion is dropped, not queued.
                if (Date.now() - new Date(row.created_at as string).getTime() > ASSIST_DROP_AFTER_MS) {
                  continue;
                }
                send("assist.suggested", row);
              }
              if (!rows?.length) send("ping", { t: Date.now() });
              await new Promise((r) => setTimeout(r, 400));
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          },
        });
      },

      /**
       * Push a partial transcript segment. Playbook matching runs first with no
       * model call; knowledge retrieval only runs when nothing matched and the
       * utterance reads like a question. Anything past the drop threshold is
       * recorded as unsurfaced rather than delivered late.
       */
      POST: async ({ request, params }) => {
        const startedAt = Date.now();
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = utteranceSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const session = await loadSession(db, params["id"] as string);
        if (!session || session.workspace_id !== input.workspace_id) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, input.workspace_id))) return apiError("forbidden", 403);

        const { data: playbooks } = await db
          .from("assist_playbooks")
          .select("triggers")
          .eq("workspace_id", input.workspace_id)
          .eq("is_active", true);
        const triggers = (playbooks ?? []).flatMap(
          (p) => (p.triggers ?? []) as PlaybookTrigger[],
        );

        let suggestionType: string | null = null;
        let suggestion: string | null = null;
        let chunkIds: string[] = [];

        const hit = matchPlaybooks(input.text, triggers);
        if (hit) {
          suggestionType = hit.suggestion_type;
          suggestion = hit.suggestion;
        } else if (looksLikeQuestion(input.text)) {
          try {
            const [vector] = (await embed([input.text])) as [number[]];
            const { data: rows } = await db.rpc("match_knowledge_chunks", {
              _workspace_id: input.workspace_id,
              _embedding: JSON.stringify(vector),
              _limit: 3,
            });
            const chunks = (rows ?? []) as { id: string; content: string }[];
            if (chunks.length) {
              suggestionType = "knowledge_answer";
              suggestion = chunks[0]!.content.slice(0, 600);
              chunkIds = chunks.map((c) => c.id);
            }
          } catch {
            // Retrieval failures never block the call; no suggestion is emitted.
          }
        }

        if (!suggestion || !suggestionType) {
          return json({ suggestion: null, latency_ms: Date.now() - startedAt });
        }

        const latency = Date.now() - startedAt;
        const surfaced = latency < ASSIST_DROP_AFTER_MS;

        const { data: event } = await db
          .from("assist_events")
          .insert({
            call_session_id: session.id,
            workspace_id: input.workspace_id,
            trigger_text: input.text,
            suggestion_type: suggestionType,
            suggestion,
            knowledge_chunk_ids: chunkIds,
            latency_ms: latency,
            surfaced,
          })
          .select("id")
          .single();

        await db.rpc("consume_credits", {
          _workspace_id: input.workspace_id,
          _meter_id: "assist_request",
          _quantity: -1,
          _app_id: caller.appId,
          _idempotency_key: `assist:${event?.id}`,
          _reference: { call_session_id: session.id },
        });

        return json({
          assist_event_id: event?.id,
          suggestion: surfaced ? suggestion : null,
          suggestion_type: suggestionType,
          knowledge_chunk_ids: chunkIds,
          latency_ms: latency,
          surfaced,
          ...(surfaced ? {} : { dropped_reason: "latency_budget_exceeded" }),
        });
      },
    },
  },
});
