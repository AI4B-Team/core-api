import { createFileRoute } from "@tanstack/react-router";
import { apiError, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

export const Route = createFileRoute("/api/public/v1/workspaces")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        if (caller.userId) {
          const { data } = await db
            .from("memberships")
            .select("role, workspaces(id, name, slug, timezone, industry, legal_entity_id)")
            .eq("user_id", caller.userId);
          return json({ workspaces: (data ?? []).map((m) => ({ ...m.workspaces, role: m.role })) });
        }

        // Service credential: every workspace entitled to this app.
        const { data } = await db
          .from("entitlements")
          .select("status, plan, workspaces(id, name, slug, timezone, industry, legal_entity_id)")
          .eq("app_id", caller.appId)
          .in("status", ["active", "trialing"]);
        return json({
          workspaces: (data ?? []).map((e) => ({ ...e.workspaces, plan: e.plan, status: e.status })),
        });
      },
    },
  },
});
