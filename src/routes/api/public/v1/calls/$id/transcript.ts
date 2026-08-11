import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  provider: z.string().max(60).optional(),
  full_text: z.string().max(500_000).optional(),
  duration_seconds: z.number().int().min(0).max(86_400).optional(),
  segments: z
    .array(
      z.object({
        speaker: z.string().max(60),
        text: z.string().max(5000),
        start_ms: z.number().int().min(0),
        end_ms: z.number().int().min(0),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(5000)
    .default([]),
});

export const Route = createFileRoute("/api/public/v1/calls/$id/transcript")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const { data: session } = await db
          .from("call_sessions")
          .select("id, workspace_id, message_id")
          .eq("id", params["id"] as string)
          .eq("workspace_id", input.workspace_id)
          .maybeSingle();
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, input.workspace_id))) return apiError("forbidden", 403);

        const fullText =
          input.full_text ?? input.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");

        const { data: transcript, error } = await db
          .from("call_transcripts")
          .insert({
            call_session_id: session.id,
            workspace_id: input.workspace_id,
            segments: input.segments,
            full_text: fullText,
            provider: input.provider ?? null,
          })
          .select("id")
          .single();
        if (error) return apiError("transcript_save_failed", 400, { detail: error.message });

        if (session.message_id) {
          await db.from("messages").update({ transcript_id: transcript.id }).eq("id", session.message_id);
        }

        const minutes = Math.ceil((input.duration_seconds ?? 0) / 60);
        if (minutes > 0) {
          await db.rpc("consume_credits", {
            _workspace_id: input.workspace_id,
            _meter_id: "transcription_minute",
            _quantity: -minutes,
            _app_id: caller.appId,
            _idempotency_key: `transcription:${transcript.id}`,
            _reference: { call_session_id: session.id },
          });
        }

        return json({ transcript_id: transcript.id, event: "transcript.ready" });
      },
    },
  },
});
