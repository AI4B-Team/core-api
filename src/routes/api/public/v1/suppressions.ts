import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  channel: z.enum(["sms", "email", "voice", "messenger", "all"]),
  identifier: z.string().min(1).max(320),
  reason: z.string().min(1).max(60),
  notes: z.string().max(1000).optional(),
  source_message_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/v1/suppressions")({
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

        const { data, error } = await db
          .from("suppressions")
          .upsert(
            {
              legal_entity_id: scope.legalEntityId,
              channel: input.channel,
              identifier: input.identifier,
              reason: input.reason,
              notes: input.notes ?? null,
              source_app_id: caller.appId,
              source_message_id: input.source_message_id ?? null,
            },
            { onConflict: "legal_entity_id,channel,identifier" },
          )
          .select("*")
          .single();
        if (error) return apiError("suppression_failed", 500, { detail: error.message });

        await db.from("suppression_audit").insert({
          legal_entity_id: scope.legalEntityId,
          suppression_id: data.id,
          action: "create",
          identifier: input.identifier,
          channel: input.channel,
          actor_app_id: caller.appId,
          notes: input.reason,
        });

        return json({ suppression: data }, 201);
      },

      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("workspace_id") ?? "";
        if (!z.string().uuid().safeParse(workspaceId).success)
          return apiError("workspace_id_required", 400);
        const scope = await assertWorkspaceScope(db, caller, workspaceId);
        if (!scope) return apiError("forbidden", 403);

        let query = db
          .from("suppressions")
          .select("*")
          .eq("legal_entity_id", scope.legalEntityId)
          .order("created_at", { ascending: false })
          .limit(200);
        const identifier = url.searchParams.get("identifier");
        if (identifier) query = query.eq("identifier", identifier);
        const { data } = await query;
        return json({ suppressions: data ?? [] });
      },
    },
  },
});
