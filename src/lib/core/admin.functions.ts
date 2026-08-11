import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mirrors the signed-in identity into Core's canonical users table. */
export const ensureCoreUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = context.claims as { email?: string; user_metadata?: { full_name?: string } };
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, is_staff, email, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing) return existing;

    // First identity in an empty Core install bootstraps staff access.
    const { count } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true });
    const { data } = await supabaseAdmin
      .from("users")
      .insert({
        id: context.userId,
        email: claims.email ?? `${context.userId}@unknown.local`,
        full_name: claims.user_metadata?.full_name ?? null,
        is_staff: (count ?? 0) === 0,
      })
      .select("id, is_staff, email, full_name")
      .single();
    return data;
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");

    const count = async (table: "accounts" | "legal_entities" | "workspaces" | "users" | "contacts" | "messages" | "apps" | "suppressions") =>
      (await supabaseAdmin.from(table).select("*", { count: "exact", head: true })).count ?? 0;

    const [accounts, entities, workspaces, users, contacts, messages, apps, suppressions] =
      await Promise.all([
        count("accounts"),
        count("legal_entities"),
        count("workspaces"),
        count("users"),
        count("contacts"),
        count("messages"),
        count("apps"),
        count("suppressions"),
      ]);

    const { data: recentChecks } = await supabaseAdmin
      .from("policy_checks")
      .select("id, action, channel, decision, denied_by, actor_type, app_id, created_at")
      .order("created_at", { ascending: false })
      .limit(12);

    const { data: recentMessages } = await supabaseAdmin
      .from("messages")
      .select("id, channel, direction, status, error_code, to_identifier, created_at")
      .order("created_at", { ascending: false })
      .limit(12);

    const { data: denials } = await supabaseAdmin
      .from("policy_checks")
      .select("denied_by")
      .eq("decision", "deny")
      .limit(500);

    const denyCounts: Record<string, number> = {};
    for (const row of denials ?? []) {
      const key = (row.denied_by as string) ?? "unknown";
      denyCounts[key] = (denyCounts[key] ?? 0) + 1;
    }

    return {
      counts: { accounts, entities, workspaces, users, contacts, messages, apps, suppressions },
      recentChecks: recentChecks ?? [],
      recentMessages: recentMessages ?? [],
      denyCounts,
      providerConfigured: Boolean(process.env["CORE_PROVIDER_API_KEY"]),
      stubAllowed: process.env["CORE_ALLOW_STUB_PROVIDER"] === "true",
    };
  });

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");

    const { data } = await supabaseAdmin
      .from("workspaces")
      .select(
        "id, name, slug, timezone, industry, created_at, legal_entities(id, legal_name, brand_status), accounts(id, name, status)",
      )
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getWorkspaceDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");

    const [workspace, entitlements, balances, policies, members] = await Promise.all([
      supabaseAdmin
        .from("workspaces")
        .select("*, legal_entities(*), accounts(*)")
        .eq("id", data.workspaceId)
        .maybeSingle(),
      supabaseAdmin.from("entitlements").select("*, apps(name)").eq("workspace_id", data.workspaceId),
      supabaseAdmin
        .from("credit_balances")
        .select("meter_id, balance, credit_meters(name, unit)")
        .eq("workspace_id", data.workspaceId),
      supabaseAdmin.from("workspace_policies").select("*").eq("workspace_id", data.workspaceId).maybeSingle(),
      supabaseAdmin
        .from("memberships")
        .select("role, users(id, email, full_name)")
        .eq("workspace_id", data.workspaceId),
    ]);

    const { data: ledger } = await supabaseAdmin
      .from("credit_ledger")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(25);

    return {
      workspace: workspace.data,
      entitlements: entitlements.data ?? [],
      balances: balances.data ?? [],
      policy: policies.data,
      members: members.data ?? [],
      ledger: ledger ?? [],
    };
  });

export const listApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    const [apps, credentials] = await Promise.all([
      supabaseAdmin.from("apps").select("*").order("id"),
      supabaseAdmin
        .from("app_credentials")
        .select("id, app_id, name, token_prefix, is_active, last_used_at, created_at"),
    ]);
    return { apps: apps.data ?? [], credentials: credentials.data ?? [] };
  });

export const listPolicyChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { decision?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    let q = supabaseAdmin
      .from("policy_checks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.decision && data.decision !== "all") q = q.eq("decision", data.decision);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    const { data } = await supabaseAdmin
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const listSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    const { data } = await supabaseAdmin
      .from("suppressions")
      .select("*, legal_entities(legal_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    const [brands, campaigns, numbers] = await Promise.all([
      supabaseAdmin.from("brands").select("*, legal_entities(legal_name)"),
      supabaseAdmin.from("campaigns_10dlc").select("*"),
      supabaseAdmin.from("phone_numbers").select("*"),
    ]);
    return { brands: brands.data ?? [], campaigns: campaigns.data ?? [], numbers: numbers.data ?? [] };
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _uid: context.userId });
    if (!isStaff) throw new Error("Forbidden: staff access required");
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("*, contact_phones(e164, line_type), contact_emails(email)")
      .order("updated_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
