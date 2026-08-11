import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertCanRecord } from "@/lib/core/policy.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  called_e164: z.string().min(3).max(32),
  contact_id: z.string().uuid().optional(),
  actor_type: z.enum(["user", "ai", "automation"]).default("user"),
  actor_id: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/v1/policy/record")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        const decision = await assertCanRecord(db, {
          workspaceId: input.workspace_id,
          appId: caller.appId,
          contactId: input.contact_id ?? null,
          actorType: input.actor_type,
          actorId: input.actor_id ?? null,
          calledE164: input.called_e164,
        });

        return json(
          {
            decision: decision.decision,
            consent_type: decision.consent_type,
            requires_announcement: decision.requires_announcement,
            policy_check_id: decision.policy_check_id,
            called_state: decision.called_state,
            rules_evaluated: decision.rules_evaluated,
            ...(decision.denied_by ? { denied_by: decision.denied_by, reason: decision.reason } : {}),
          },
          decision.decision === "deny" ? 403 : 200,
        );
      },
    },
  },
});
