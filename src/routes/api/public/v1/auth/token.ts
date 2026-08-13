import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, getAdmin, json } from "@/lib/core/api.server";
import { randomToken, sha256Hex, signJwt } from "@/lib/core/jwt.server";

const schema = z.object({
  code: z.string().min(10).max(200),
  redirect_uri: z.string().url().max(500),
  app_id: z.string().min(1).max(60),
});

export const ACCESS_TTL = 15 * 60;

export const Route = createFileRoute("/api/public/v1/auth/token")({
  server: {
    handlers: {
      /** Exchanges a short-lived authorization code for a Core-signed JWT. */
      POST: async ({ request }) => {
        const db = await getAdmin();
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const codeHash = await sha256Hex(input.code);
        const { data: row } = await db
          .from("auth_codes")
          .select("*")
          .eq("code_hash", codeHash)
          .maybeSingle();

        if (
          !row ||
          row.consumed_at ||
          new Date(row.expires_at as string) < new Date() ||
          row.app_id !== input.app_id ||
          row.redirect_uri !== input.redirect_uri
        ) {
          return apiError("invalid_grant", 400);
        }

        await db
          .from("auth_codes")
          .update({ consumed_at: new Date().toISOString() })
          .eq("code_hash", codeHash);

        const token = await issueAccessToken(db, row.user_id as string, row.app_id as string, row.workspace_id as string);
        if (!token) return apiError("forbidden", 403);
        return json(token);
      },
    },
  },
});

/**
 * Mints a workspace-scoped access token. Membership and an active entitlement
 * for the requesting app are re-verified on every issuance, so a stale code or
 * refresh token can never outlive access being taken away.
 */
export async function issueAccessToken(
  db: Awaited<ReturnType<typeof getAdmin>>,
  userId: string,
  appId: string,
  workspaceId: string,
) {
  const { data: workspace } = await db
    .from("workspaces")
    .select("id, account_id, legal_entity_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return null;

  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!membership) return null;

  const { data: entitlements } = await db
    .from("entitlements")
    .select("app_id")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "trialing"]);
  if (!(entitlements ?? []).some((e) => e.app_id === appId)) return null;


  const accessToken = await signJwt(
    {
      sub: userId,
      account_id: workspace?.account_id,
      legal_entity_id: workspace?.legal_entity_id,
      workspace_id: workspaceId,
      app_id: appId,
      role: membership?.role ?? "member",
      entitlements: (entitlements ?? []).map((e) => e.app_id),
      iss: "https://auth.realelite.com",
    },
    ACCESS_TTL,
  );

  const refresh = `core_rt_${randomToken(32)}`;
  await db.from("refresh_tokens").insert({
    token_hash: await sha256Hex(refresh),
    user_id: userId,
    app_id: appId,
    workspace_id: workspaceId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refresh,
    workspace_id: workspaceId,
  };
}
