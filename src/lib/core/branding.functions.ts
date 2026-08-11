import { createServerFn } from "@tanstack/react-start";

export type CoreBranding = {
  brandName: string;
  logoUrl: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  appName: string | null;
  appIcon: string | null;
};

const NEUTRAL: CoreBranding = {
  brandName: "Real Elite",
  logoUrl: null,
  accentColor: null,
  supportEmail: null,
  appName: null,
  appIcon: null,
};

/**
 * Public branding lookup for the customer-facing auth screens.
 * Returns neutral Real Elite branding unless an account with white-label
 * settings is identified (account id in the URL, or the requesting app).
 */
export const getAuthBranding = createServerFn({ method: "POST" })
  .inputValidator((d: { accountId?: string; appId?: string }) => d)
  .handler(async ({ data }): Promise<CoreBranding> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const branding: CoreBranding = { ...NEUTRAL };

    if (data.appId) {
      const { data: app } = await supabaseAdmin
        .from("apps")
        .select("name, icon")
        .eq("id", data.appId)
        .maybeSingle();
      if (app) {
        branding.appName = app.name as string;
        branding.appIcon = (app.icon as string) ?? null;
      }
    }

    if (data.accountId && /^[0-9a-f-]{36}$/i.test(data.accountId)) {
      const { data: account } = await supabaseAdmin
        .from("accounts")
        .select("name, brand_name, logo_url, accent_color, support_email")
        .eq("id", data.accountId)
        .maybeSingle();
      if (account) {
        branding.brandName = (account.brand_name as string) || (account.name as string) || NEUTRAL.brandName;
        branding.logoUrl = (account.logo_url as string) ?? null;
        branding.accentColor = (account.accent_color as string) ?? null;
        branding.supportEmail = (account.support_email as string) ?? null;
      }
    }

    return branding;
  });
