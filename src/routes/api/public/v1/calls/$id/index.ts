import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { extractFromSource } from "@/lib/core/extraction.server";

const patchSchema = z.object({
  workspace_id: z.string().uuid(),
  status: z.enum(["ringing", "in_progress", "completed", "failed", "no_answer", "voicemail"]),
  disposition: z.string().max(120).optional(),
  duration_seconds: z.number().int().min(0).max(86_400).optional(),
  recording_url: z.string().url().max(2000).optional(),
  answered_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  run_extraction: z.boolean().default(true),
  schema_id: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/v1/calls/$id/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        const { data: session } = await db
          .from("call_sessions")
          .select("*")
          .eq("id", params["id"] as string)
          .maybeSingle();
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, session.workspace_id as string)))
          return apiError("forbidden", 403);

        const [{ data: participants }, { data: transcripts }] = await Promise.all([
          db.from("call_participants").select("*").eq("call_session_id", session.id),
          db
            .from("call_transcripts")
            .select("id, provider, full_text, created_at")
            .eq("call_session_id", session.id),
        ]);
        return json({ call: session, participants: participants ?? [], transcripts: transcripts ?? [] });
      },

      /** Call lifecycle update. On completion, meters minutes and runs one extraction pass. */
      PATCH: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = patchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const { data: session } = await db
          .from("call_sessions")
          .select("*")
          .eq("id", params["id"] as string)
          .eq("workspace_id", input.workspace_id)
          .maybeSingle();
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, input.workspace_id))) return apiError("forbidden", 403);

        // Recording is only ever attached to a session that passed assertCanRecord.
        if (input.recording_url && !session.recorded) {
          return apiError("recording_not_authorized", 403);
        }

        const ended = ["completed", "failed", "no_answer", "voicemail"].includes(input.status);
        await db
          .from("call_sessions")
          .update({
            status: input.status,
            disposition: input.disposition ?? session.disposition,
            answered_at: input.answered_at ?? session.answered_at,
            ended_at: input.ended_at ?? (ended ? new Date().toISOString() : session.ended_at),
          })
          .eq("id", session.id);

        if (session.message_id) {
          await db
            .from("messages")
            .update({
              status: input.status,
              duration_seconds: input.duration_seconds ?? null,
              recording_url: input.recording_url ?? null,
            })
            .eq("id", session.message_id);
        }

        const minutes = Math.ceil((input.duration_seconds ?? 0) / 60);
        if (ended && minutes > 0) {
          await db.rpc("consume_credits", {
            _workspace_id: input.workspace_id,
            _meter_id: "call_minute",
            _quantity: -minutes,
            _app_id: caller.appId,
            _idempotency_key: `call_minute:${session.id}`,
            _reference: { call_session_id: session.id },
          });
          if (session.recorded) {
            await db.rpc("consume_credits", {
              _workspace_id: input.workspace_id,
              _meter_id: "recording_storage_minute",
              _quantity: -minutes,
              _app_id: caller.appId,
              _idempotency_key: `recording_minute:${session.id}`,
              _reference: { call_session_id: session.id },
            });
          }
        }

        let extraction: unknown = null;
        if (ended && input.run_extraction) {
          try {
            extraction = await extractFromSource(db, {
              workspaceId: input.workspace_id,
              sourceType: "call",
              sourceId: session.id as string,
              ...(input.schema_id ? { schemaId: input.schema_id } : {}),
            });
          } catch {
            // No transcript yet, or the model was unavailable — extraction can be
            // re-run explicitly via POST /v1/extraction/run.
            extraction = null;
          }
        }

        return json({ call_session_id: session.id, status: input.status, extraction });
      },
    },
  },
});
