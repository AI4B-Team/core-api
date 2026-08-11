import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

export const Route = createFileRoute("/api/public/v1/credits/balance")({
  server: {
    handlers: {
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

        const { data } = await db
          .from("credit_balances")
          .select("meter_id, balance, credit_meters(name, unit)")
          .eq("workspace_id", workspaceId);
        return json({ balances: data ?? [] });
      },
    },
  },
});
