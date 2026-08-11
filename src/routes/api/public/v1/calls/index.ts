import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertCanRecord, assertPolicy } from "@/lib/core/policy.server";
import { placeCallViaProvider, stubProviderAllowed, voiceProviderConfigured } from "@/lib/core/provider.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  from: z.string().min(3).max(32),
  to: z.string().min(3).max(32),
  record: z.boolean().default(false),
  actor_type: z.enum(["user", "ai", "automation"]).default("user"),
  actor_id: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/v1/calls/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        const workspaceId = new URL(request.url).searchParams.get("workspace_id") ?? "";
        if (!z.string().uuid().safeParse(workspaceId).success)
          return apiError("workspace_id_required", 400);
        if (!(await assertWorkspaceScope(db, caller, workspaceId))) return apiError("forbidden", 403);
        const { data } = await db
          .from("call_sessions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(100);
        return json({ calls: data ?? [] });
      },

      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        // 1. Calling is gated by the same policy engine as messaging.
        const callDecision = await assertPolicy(db, {
          workspaceId: input.workspace_id,
          appId: caller.appId,
          action: "call",
          channel: "voice",
          identifier: input.to,
          contactId: input.contact_id,
          actorType: input.actor_type,
          actorId: input.actor_id ?? null,
        });
        if (callDecision.decision === "deny") {
          return json(
            {
              error: "policy_denied",
              denied_by: callDecision.denied_by,
              reason: callDecision.reason,
              policy_check_id: callDecision.policy_check_id,
            },
            403,
          );
        }

        // 2. No recording without a passing assertCanRecord. Unknown or
        //    all-party jurisdictions require an announcement, never a plain allow.
        let recording: Awaited<ReturnType<typeof assertCanRecord>> | null = null;
        if (input.record) {
          recording = await assertCanRecord(db, {
            workspaceId: input.workspace_id,
            appId: caller.appId,
            contactId: input.contact_id,
            actorType: input.actor_type,
            actorId: input.actor_id ?? null,
            calledE164: input.to,
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

        const { data: conversation } = await db
          .from("conversations")
          .upsert(
            { workspace_id: input.workspace_id, contact_id: input.contact_id },
            { onConflict: "workspace_id,contact_id" },
          )
          .select("id")
          .single();

        const result =
          voiceProviderConfigured() || stubProviderAllowed()
            ? await placeCallViaProvider({
                from: input.from,
                to: input.to,
                record: input.record,
                announce: recording?.requires_announcement ?? false,
              })
            : ({ ok: false, error: "provider_not_configured", errorCode: "no_provider" } as const);

        const consentState = !input.record
          ? "not_recorded"
          : recording?.requires_announcement
            ? "announced"
            : "one_party";

        const base = {
          workspace_id: input.workspace_id,
          conversation_id: conversation?.id ?? null,
          direction: "outbound" as const,
          from_e164: input.from,
          to_e164: input.to,
          provider: null as string | null,
          policy_check_id: recording?.policy_check_id ?? callDecision.policy_check_id,
        };

        if (!result.ok) {
          // Fail closed: never 'ringing', never 'in_progress'.
          const { data: failed } = await db
            .from("call_sessions")
            .insert({ ...base, status: "failed", recorded: false })
            .select("id")
            .single();

          await db.from("messages").insert({
            conversation_id: conversation?.id,
            workspace_id: input.workspace_id,
            app_id: caller.appId,
            channel: "voice",
            direction: "outbound",
            from_identifier: input.from,
            to_identifier: input.to,
            status: "failed",
            error_code: "no_provider",
            recording_consent_state: "not_recorded",
            policy_check_id: callDecision.policy_check_id,
          });

          return json(
            {
              error: "provider_not_configured",
              call_session_id: failed?.id,
              policy_check_id: callDecision.policy_check_id,
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
            },
            503,
          );
        }

        const { data: message } = await db
          .from("messages")
          .insert({
            conversation_id: conversation?.id,
            workspace_id: input.workspace_id,
            app_id: caller.appId,
            channel: "voice",
            direction: "outbound",
            from_identifier: input.from,
            to_identifier: input.to,
            status: "ringing",
            recording_consent_state: consentState,
            policy_check_id: callDecision.policy_check_id,
          })
          .select("id")
          .single();

        const { data: session } = await db
          .from("call_sessions")
          .insert({
            ...base,
            message_id: message?.id ?? null,
            provider_call_id: result.providerCallId,
            status: "ringing",
            started_at: new Date().toISOString(),
            recorded: input.record,
          })
          .select("id, status")
          .single();

        if (session?.id) {
          await db.from("call_participants").insert({
            call_session_id: session.id,
            workspace_id: input.workspace_id,
            external_e164: input.to,
            role: "contact",
          });
        }

        return json({
          call_session_id: session?.id,
          status: session?.status,
          policy_check_id: callDecision.policy_check_id,
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
