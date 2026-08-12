import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertPolicy } from "@/lib/core/policy.server";

const MAX_IDENTIFIERS = 1000;
const CONCURRENCY = 16;

const schema = z.object({
  workspace_id: z.string().uuid(),
  action: z.enum(["send", "call", "offer", "negotiate", "sign"]),
  channel: z.string().max(20).optional(),
  identifiers: z.array(z.string().min(1).max(320)).min(1).max(MAX_IDENTIFIERS),
  actor_type: z.enum(["user", "ai", "automation"]),
  actor_id: z.string().max(200).optional(),
});

const ADVISORY_NOTE =
  "Results are point-in-time and advisory only. Callers MUST re-check at the moment of contact via POST /v1/policy/assert, or by sending through /v1/messages/send or /v1/calls. Bulk assert is for building and filtering queues, never for authorizing a send.";

export const Route = createFileRoute("/api/public/v1/policy/assert-bulk")({
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

        const identifiers = input.identifiers;
        const results = new Array<{
          identifier: string;
          decision: string;
          denied_by: string | null;
          reason: string | null;
          policy_check_id: string | null;
          error?: string;
        }>(identifiers.length);

        let cursor = 0;
        const worker = async () => {
          for (;;) {
            const i = cursor++;
            if (i >= identifiers.length) return;
            const identifier = identifiers[i]!;
            try {
              // Identical engine, identical rules, one policy_checks row each.
              const decision = await assertPolicy(db, {
                workspaceId: input.workspace_id,
                appId: caller.appId,
                action: input.action,
                channel: input.channel ?? null,
                identifier,
                contactId: null,
                actorType: input.actor_type,
                actorId: input.actor_id ?? null,
              });
              results[i] = {
                identifier,
                decision: decision.decision,
                denied_by: decision.denied_by ?? null,
                reason: decision.reason ?? null,
                policy_check_id: decision.policy_check_id,
              };
            } catch (err) {
              results[i] = {
                identifier,
                decision: "error",
                denied_by: null,
                reason: null,
                policy_check_id: null,
                error: err instanceof Error ? err.message : "unknown_error",
              };
            }
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, identifiers.length) }, () => worker()),
        );

        const denied_by_rule: Record<string, number> = {};
        let allowed = 0;
        let denied = 0;
        let errors = 0;
        for (const r of results) {
          if (r.decision === "allow") allowed++;
          else if (r.decision === "error") errors++;
          else {
            denied++;
            const key = r.denied_by ?? "unknown";
            denied_by_rule[key] = (denied_by_rule[key] ?? 0) + 1;
          }
        }

        return json({
          advisory_only: true,
          note: ADVISORY_NOTE,
          evaluated_at: new Date().toISOString(),
          results,
          summary: {
            total: results.length,
            allowed,
            denied,
            errors,
            denied_by_rule,
          },
        });
      },
    },
  },
});
