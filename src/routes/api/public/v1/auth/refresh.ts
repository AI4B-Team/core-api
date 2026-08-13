import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, getAdmin, json } from "@/lib/core/api.server";
import { sha256Hex } from "@/lib/core/jwt.server";
import { issueAccessToken } from "./token";

const schema = z.object({
  refresh_token: z.string().min(10).max(300),
  /** Workspace switching issues a new token instead of mutating the old one. */
  workspace_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/v1/auth/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await getAdmin();
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });

        const hash = await sha256Hex(parsed.data.refresh_token);
        const { data: row } = await db
          .from("refresh_tokens")
          .select("*")
          .eq("token_hash", hash)
          .maybeSingle();
        if (!row || row.revoked_at || new Date(row.expires_at as string) < new Date())
          return apiError("invalid_grant", 400);

        let workspaceId = row.workspace_id as string;
        if (parsed.data.workspace_id && parsed.data.workspace_id !== workspaceId) {
          const { data: membership } = await db
            .from("memberships")
            .select("id")
            .eq("user_id", row.user_id)
            .eq("workspace_id", parsed.data.workspace_id)
            .maybeSingle();
          if (!membership) return apiError("forbidden", 403);
          workspaceId = parsed.data.workspace_id;
        }

        await db.from("refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash);
        const issued = await issueAccessToken(db, row.user_id as string, row.app_id as string, workspaceId);
        if (!issued) return apiError("forbidden", 403);
        return json(issued);

      },
    },
  },
});
