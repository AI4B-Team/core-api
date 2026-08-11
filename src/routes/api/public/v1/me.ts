import { createFileRoute } from "@tanstack/react-router";
import { apiError, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        if (!caller.userId) return apiError("user_token_required", 400);

        const { data: user } = await db
          .from("users")
          .select("id, email, full_name, avatar_url, is_staff")
          .eq("id", caller.userId)
          .maybeSingle();

        const { data: memberships } = await db
          .from("memberships")
          .select("role, workspaces(id, name, slug, account_id, legal_entity_id, timezone)")
          .eq("user_id", caller.userId);

        return json({ user, memberships: memberships ?? [], app_id: caller.appId });
      },
    },
  },
});
