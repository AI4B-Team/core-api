import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertPolicy } from "@/lib/core/policy.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  action: z.enum(["send", "call", "offer", "negotiate", "sign"]),
  channel: z.string().max(20).optional(),
  identifier: z.string().max(320).optional(),
  contact_id: z.string().uuid().optional(),
  actor_type: z.enum(["user", "ai", "automation"]),
  actor_id: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/v1/policy/assert")({
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

        const decision = await assertPolicy(db, {
          workspaceId: input.workspace_id,
          appId: caller.appId,
          action: input.action,
          channel: input.channel ?? null,
          identifier: input.identifier ?? null,
          contactId: input.contact_id ?? null,
          actorType: input.actor_type,
          actorId: input.actor_id ?? null,
        });

        return json(decision, decision.decision === "allow" ? 200 : 403);
      },
    },
  },
});
