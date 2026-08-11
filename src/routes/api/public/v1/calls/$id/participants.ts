import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertCanRecord } from "@/lib/core/policy.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  role: z.enum([
    "agent",
    "contact",
    "merged",
    "transferred_to",
    "supervisor_monitor",
    "supervisor_whisper",
    "supervisor_barge",
  ]),
  user_id: z.string().uuid().optional(),
  external_e164: z.string().max(32).optional(),
  actor_id: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/v1/calls/$id/participants")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        const { data: session } = await db
          .from("call_sessions")
          .select("id, workspace_id")
          .eq("id", params["id"] as string)
          .maybeSingle();
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, session.workspace_id as string)))
          return apiError("forbidden", 403);
        const { data } = await db
          .from("call_participants")
          .select("*")
          .eq("call_session_id", session.id)
          .order("joined_at", { ascending: true });
        return json({ participants: data ?? [] });
      },

      /**
       * Supervisor monitor/whisper/barge and merges/transfers all join the same
       * call_session. If the call is being recorded, the new leg is re-checked
       * against assertCanRecord — no exceptions for supervision.
       */
      POST: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const { data: session } = await db
          .from("call_sessions")
          .select("id, workspace_id, to_e164, recorded")
          .eq("id", params["id"] as string)
          .eq("workspace_id", input.workspace_id)
          .maybeSingle();
        if (!session) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, input.workspace_id))) return apiError("forbidden", 403);

        let recording: Awaited<ReturnType<typeof assertCanRecord>> | null = null;
        if (session.recorded) {
          recording = await assertCanRecord(db, {
            workspaceId: input.workspace_id,
            appId: caller.appId,
            contactId: null,
            actorType: "user",
            actorId: input.actor_id ?? input.user_id ?? null,
            calledE164: input.external_e164 ?? (session.to_e164 as string),
          });
          if (recording.decision === "deny") {
            return json(
              {
                error: "recording_denied",
                denied_by: recording.denied_by,
                reason: recording.reason,
                policy_check_id: recording.policy_check_id,
              },
              403,
            );
          }
        }

        const { data, error } = await db
          .from("call_participants")
          .insert({
            call_session_id: session.id,
            workspace_id: input.workspace_id,
            user_id: input.user_id ?? null,
            external_e164: input.external_e164 ?? null,
            role: input.role,
          })
          .select("id, role, joined_at")
          .single();
        if (error) return apiError("participant_add_failed", 400, { detail: error.message });

        return json({
          participant: data,
          ...(recording
            ? {
                recording: {
                  decision: recording.decision,
                  consent_type: recording.consent_type,
                  requires_announcement: recording.requires_announcement,
                  policy_check_id: recording.policy_check_id,
                },
              }
            : {}),
        });
      },
    },
  },
});
