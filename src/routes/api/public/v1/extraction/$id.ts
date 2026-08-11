import { createFileRoute } from "@tanstack/react-router";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

export const Route = createFileRoute("/api/public/v1/extraction/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const { data } = await db
          .from("extraction_results")
          .select("*")
          .eq("id", params["id"] as string)
          .maybeSingle();
        if (!data) return apiError("not_found", 404);
        if (!(await assertWorkspaceScope(db, caller, data.workspace_id as string)))
          return apiError("forbidden", 403);

        return json({ extraction: data });
      },
    },
  },
});
