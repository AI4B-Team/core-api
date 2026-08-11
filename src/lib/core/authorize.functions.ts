import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Details an app handoff needs before the user consents. */
export const getAuthorizeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app } = await supabaseAdmin
      .from("apps")
      .select("id, name, description, base_url, manifest")
      .eq("id", data.appId)
      .maybeSingle();

    const { data: memberships } = await supabaseAdmin
      .from("memberships")
      .select("role, workspaces(id, name, slug, account_id)")
      .eq("user_id", context.userId);

    const workspaceIds = (memberships ?? [])
      .map((m) => (m.workspaces as { id: string } | null)?.id)
      .filter((id): id is string => Boolean(id));

    const { data: entitlements } = await supabaseAdmin
      .from("entitlements")
      .select("workspace_id, status, plan")
      .eq("app_id", data.appId)
      .in("workspace_id", workspaceIds.length ? workspaceIds : ["00000000-0000-0000-0000-000000000000"]);

    const accountIds = Array.from(
      new Set(
        (memberships ?? [])
          .map((m) => (m.workspaces as { account_id?: string } | null)?.account_id)
          .filter((a): a is string => Boolean(a)),
      ),
    );
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("id, name, brand_name, logo_url, accent_color, support_email")
      .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);

    // White-label only applies when every workspace belongs to one account.
    const soleAccount = accounts && accounts.length === 1 ? accounts[0] : null;
    const branding = {
      brandName: (soleAccount?.brand_name as string) || "Real Elite",
      logoUrl: (soleAccount?.logo_url as string) ?? null,
      accentColor: (soleAccount?.accent_color as string) ?? null,
      supportEmail: (soleAccount?.support_email as string) ?? null,
      appName: (app?.name as string) ?? null,
      appIcon: null as string | null,
    };

    return {
      app,
      branding,
      workspaces: (memberships ?? []).map((m) => {
        const ws = m.workspaces as { id: string; name: string; slug: string; account_id?: string } | null;
        const account = (accounts ?? []).find((a) => a.id === ws?.account_id);
        const ent = (entitlements ?? []).find((e) => e.workspace_id === ws?.id);
        return {
          id: ws?.id ?? "",
          name: ws?.name ?? "",
          slug: ws?.slug ?? "",
          role: m.role as string,
          entitled: Boolean(ent && ["active", "trialing"].includes(ent.status as string)),
          plan: (ent?.plan as string) ?? null,
          accountName: ((account?.brand_name as string) || (account?.name as string)) ?? null,
        };
      }),
    };
  });

/** Issues a single-use code the app exchanges at /api/public/v1/auth/token. */
export const issueAuthCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appId: string; workspaceId: string; redirectUri: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomToken, sha256Hex } = await import("@/lib/core/jwt.server");

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this workspace");

    const { data: entitlement } = await supabaseAdmin
      .from("entitlements")
      .select("status")
      .eq("workspace_id", data.workspaceId)
      .eq("app_id", data.appId)
      .maybeSingle();
    if (!entitlement || !["active", "trialing"].includes(entitlement.status as string))
      throw new Error("This workspace is not entitled to that app");

    let redirect: URL;
    try {
      redirect = new URL(data.redirectUri);
    } catch {
      throw new Error("Invalid redirect_uri");
    }

    const { data: app } = await supabaseAdmin
      .from("apps")
      .select("manifest")
      .eq("id", data.appId)
      .maybeSingle();
    const manifest = (app?.manifest ?? {}) as { redirect_uris?: string[] };
    const allowed = manifest.redirect_uris ?? [];
    if (allowed.length && !allowed.includes(redirect.toString()))
      throw new Error("redirect_uri is not registered for this app");

    const code = `core_ac_${randomToken(32)}`;
    await supabaseAdmin.from("auth_codes").insert({
      code_hash: await sha256Hex(code),
      user_id: context.userId,
      app_id: data.appId,
      workspace_id: data.workspaceId,
      redirect_uri: redirect.toString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    redirect.searchParams.set("code", code);
    redirect.searchParams.set("workspace_id", data.workspaceId);
    return { redirectTo: redirect.toString() };
  });
