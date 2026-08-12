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

/** Issues a service credential. The plaintext token is returned once and never stored. */
export const createAppCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const { sha256Hex } = await import("./jwt.server");

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const token = `core_sk_${hex}`;
    const token_prefix = token.slice(0, 16);
    const token_hash = await sha256Hex(token);

    const { data: row, error } = await db
      .from("app_credentials")
      .insert({
        app_id: data.app_id,
        name: data.name.trim() || "service credential",
        token_prefix,
        token_hash,
        is_active: true,
      })
      .select("id, app_id, name, token_prefix, is_active, last_used_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { credential: row, token };
  });

export const revokeAppCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const { error } = await db
      .from("app_credentials")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAppBaseUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_id: string; base_url: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const url = data.base_url.trim();
    if (!/^https?:\/\/.+/i.test(url)) throw new Error("base_url must be an http(s) URL");
    const { error } = await db.from("apps").update({ base_url: url }).eq("id", data.app_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Edit the redirect_uris allow-list stored on an app's manifest. */
export const updateAppRedirectUris = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_id: string; redirect_uris: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const uris = data.redirect_uris.map((u) => u.trim()).filter(Boolean);
    for (const u of uris) {
      if (!/^https?:\/\/.+/i.test(u)) throw new Error(`Invalid redirect URI: ${u}`);
    }
    const { data: app, error: readErr } = await db
      .from("apps")
      .select("manifest")
      .eq("id", data.app_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!app) throw new Error("App not found");
    const manifest = { ...((app.manifest as Record<string, unknown>) ?? {}), redirect_uris: uris };
    const { error } = await db.from("apps").update({ manifest }).eq("id", data.app_id);
    if (error) throw new Error(error.message);
    return { ok: true, redirect_uris: uris };
  });

/** Accounts and legal entities available when provisioning a workspace. */
export const listOrgTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const [accounts, entities] = await Promise.all([
      db.from("accounts").select("id, name, type, billing_email, created_at").order("created_at"),
      db.from("legal_entities").select("id, account_id, legal_name, entity_type, country").order("created_at"),
    ]);
    return { accounts: accounts.data ?? [], entities: entities.data ?? [] };
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; type: string; billing_email: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const name = data.name.trim();
    const billing_email = data.billing_email.trim();
    if (!name) throw new Error("Name is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billing_email)) throw new Error("A valid billing email is required");
    const { data: row, error } = await db
      .from("accounts")
      .insert({ name, type: data.type || "direct", billing_email })
      .select("id, name, type, billing_email")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { account_id: string; legal_name: string; ein?: string; entity_type?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const legal_name = data.legal_name.trim();
    if (!data.account_id) throw new Error("An account is required");
    if (!legal_name) throw new Error("Legal name is required");
    const { data: row, error } = await db
      .from("legal_entities")
      .insert({
        account_id: data.account_id,
        legal_name,
        ein: data.ein?.trim() || null,
        entity_type: data.entity_type?.trim() || null,
      })
      .select("id, account_id, legal_name, entity_type")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      account_id: string;
      legal_entity_id: string;
      name: string;
      slug: string;
      timezone?: string;
      industry?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const name = data.name.trim();
    const slug = data.slug.trim().toLowerCase();
    if (!name) throw new Error("Name is required");
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug))
      throw new Error("Slug must be lowercase letters, numbers and hyphens");

    const { data: le } = await db
      .from("legal_entities")
      .select("id, account_id")
      .eq("id", data.legal_entity_id)
      .maybeSingle();
    if (!le) throw new Error("Legal entity not found");
    if (le.account_id !== data.account_id)
      throw new Error("The legal entity must belong to the selected account");

    const { data: clash } = await db
      .from("workspaces")
      .select("id")
      .eq("account_id", data.account_id)
      .eq("slug", slug)
      .maybeSingle();
    if (clash) throw new Error("That slug is already used in this account");

    const { data: row, error } = await db
      .from("workspaces")
      .insert({
        account_id: data.account_id,
        legal_entity_id: data.legal_entity_id,
        name,
        slug,
        timezone: data.timezone?.trim() || "America/New_York",
        industry: data.industry?.trim() || null,
      })
      .select("id, name, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const grantEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string; app_id: string; plan?: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const { data: existing } = await db
      .from("entitlements")
      .select("id")
      .eq("workspace_id", data.workspace_id)
      .eq("app_id", data.app_id)
      .maybeSingle();
    const payload = { plan: data.plan?.trim() || "standard", status: data.status?.trim() || "active" };
    if (existing) {
      const { error } = await db.from("entitlements").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, ...payload };
    }
    const { data: row, error } = await db
      .from("entitlements")
      .insert({ workspace_id: data.workspace_id, app_id: data.app_id, ...payload })
      .select("id, app_id, plan, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("./staff.server");
    const db = await assertStaff(context.userId);
    const { error } = await db.from("entitlements").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
