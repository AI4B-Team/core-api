import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { assertPolicy } from "@/lib/core/policy.server";
import { providerConfigured, sendViaProvider, stubProviderAllowed } from "@/lib/core/provider.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  channel: z.enum(["sms", "mms", "email", "voice", "messenger"]).default("sms"),
  from: z.string().min(1).max(320),
  to: z.string().min(1).max(320),
  body: z.string().min(1).max(4000),
  actor_type: z.enum(["user", "ai", "automation"]).default("user"),
  actor_id: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/v1/messages/send")({
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

        // The policy engine is never stubbed. A deny is terminal, even when no
        // provider is available.
        const decision = await assertPolicy(db, {
          workspaceId: input.workspace_id,
          appId: caller.appId,
          action: "send",
          channel: input.channel,
          identifier: input.to,
          contactId: input.contact_id,
          actorType: input.actor_type,
          actorId: input.actor_id ?? null,
        });

        if (decision.decision === "deny") {
          return json(
            {
              error: "policy_denied",
              denied_by: decision.denied_by,
              reason: decision.reason,
              policy_check_id: decision.policy_check_id,
            },
            403,
          );
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
          providerConfigured() || stubProviderAllowed()
            ? await sendViaProvider({
                from: input.from,
                to: input.to,
                body: input.body,
                channel: input.channel,
              })
            : ({ ok: false, error: "provider_not_configured", errorCode: "no_provider" } as const);

        const base = {
          conversation_id: conversation?.id,
          workspace_id: input.workspace_id,
          app_id: caller.appId,
          channel: input.channel,
          direction: "outbound" as const,
          from_identifier: input.from,
          to_identifier: input.to,
          body: input.body,
          segments: Math.ceil(input.body.length / 160),
          policy_check_id: decision.policy_check_id,
        };

        if (!result.ok) {
          const { data: failed } = await db
            .from("messages")
            .insert({ ...base, status: "failed", error_code: result.errorCode })
            .select("id")
            .single();
          return json(
            {
              error: "provider_not_configured",
              message_id: failed?.id,
              policy_check_id: decision.policy_check_id,
            },
            503,
          );
        }

        const { data: sent } = await db
          .from("messages")
          .insert({
            ...base,
            status: "queued",
            provider_message_id: result.providerMessageId,
            sent_at: new Date().toISOString(),
          })
          .select("id, status")
          .single();

        await db
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation?.id);

        return json({ message_id: sent?.id, status: sent?.status, policy_check_id: decision.policy_check_id });
      },
    },
  },
});
