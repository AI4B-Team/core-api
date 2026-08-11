import { sha256Hex, verifyJwt } from "./jwt.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AppCaller {
  appId: string;
  credentialId: string;
  /** Present when the caller authenticated with a user JWT rather than a service credential. */
  userId?: string;
  workspaceId?: string;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function apiError(error: string, status: number, extra?: Record<string, unknown>) {
  return json({ error, ...(extra ?? {}) }, status);
}

export async function getAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * Every /v1 call authenticates either with a per-app service credential
 * (`Authorization: Bearer core_sk_...`) or with a Core-issued user JWT.
 * The workspace scope is always passed explicitly and always re-checked.
 */
export async function authenticateCaller(
  request: Request,
  db: SupabaseClient,
): Promise<AppCaller | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  if (token.startsWith("core_sk_")) {
    const prefix = token.slice(0, 16);
    const hash = await sha256Hex(token);
    const { data } = await db
      .from("app_credentials")
      .select("id, app_id, token_hash, is_active")
      .eq("token_prefix", prefix)
      .eq("is_active", true);
    const match = (data ?? []).find((row) => row.token_hash === hash);
    if (!match) return null;
    await db
      .from("app_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", match.id);
    return { appId: match.app_id as string, credentialId: match.id as string };
  }

  const claims = await verifyJwt<{
    sub: string;
    app_id: string;
    workspace_id: string;
  }>(token);
  if (!claims) return null;
  return {
    appId: claims.app_id,
    credentialId: "jwt",
    userId: claims.sub,
    workspaceId: claims.workspace_id,
  };
}

/** A caller may only act inside a workspace entitled to its app. */
export async function assertWorkspaceScope(
  db: SupabaseClient,
  caller: AppCaller,
  workspaceId: string,
): Promise<{ workspaceId: string; legalEntityId: string } | null> {
  if (caller.workspaceId && caller.workspaceId !== workspaceId) return null;
  const { data: workspace } = await db
    .from("workspaces")
    .select("id, legal_entity_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return null;

  if (caller.appId !== "core-admin") {
    const { data: entitlement } = await db
      .from("entitlements")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .eq("app_id", caller.appId)
      .maybeSingle();
    if (!entitlement || !["active", "trialing"].includes(entitlement.status as string)) return null;
  }
  return { workspaceId, legalEntityId: workspace.legal_entity_id as string };
}
