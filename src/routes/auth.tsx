import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthBranding } from "@/lib/core/branding.functions";
import { BrandFooter, BrandMark } from "@/components/console/auth-brand";

function safePath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/admin";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Real Elite" },
      { name: "description", content: "Sign in once to reach every Real Elite application." },
      { property: "og:title", content: "Sign in — Real Elite" },
      { property: "og:description", content: "Centralized sign-in for the Real Elite platform." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
    app_id: typeof search["app_id"] === "string" ? (search["app_id"] as string) : undefined,
    account: typeof search["account"] === "string" ? (search["account"] as string) : undefined,
  }),
  component: AuthScreen,
});

type Mode = "password" | "magic" | "signup";

function AuthScreen() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const next = safePath(search.redirect);
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  let appIdFromRedirect: string | undefined;
  try {
    if (search.redirect) {
      const v = new URLSearchParams(search.redirect.split("?")[1] ?? "").get("app_id");
      appIdFromRedirect = v ?? undefined;
    }
  } catch {
    appIdFromRedirect = undefined;
  }
  const appId = search.app_id ?? appIdFromRedirect;

  const brandFn = useServerFn(getAuthBranding);
  const { data: branding } = useQuery({
    queryKey: ["auth-branding", appId ?? null, search.account ?? null],
    queryFn: () =>
      brandFn({
        data: {
          ...(appId ? { appId } : {}),
          ...(search.account ? { accountId: search.account } : {}),
        },
      }),
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(next);
    });
  }, [next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        setLinkSent(true);
        toast.success("Magic link sent — check your inbox.");
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.replace(next);
      else toast.info("Check your inbox to confirm your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: next });
  }

  const brandName = branding?.brandName ?? "Real Elite";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="grid-bg hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between">
        <BrandMark branding={branding} />
        <div>
          <h2 className="max-w-sm text-3xl leading-tight font-semibold">
            One sign-in for every {brandName} application.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            {branding?.appName
              ? `${branding.appName} uses ${brandName} to verify who you are and which workspace you are working in.`
              : `Your account, workspaces and permissions travel with you across the platform.`}
          </p>
        </div>
        <span className="mono-label">auth.realelite.com</span>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark branding={branding} />
          </div>
          <p className="mono-label mt-8 lg:mt-0">
            {mode === "signup" ? "create account" : "sign in"}
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            {mode === "signup"
              ? `Create your ${brandName} account`
              : branding?.appName
                ? `Continue to ${branding.appName}`
                : `Sign in to ${brandName}`}
          </h1>

          {linkSent ? (
            <div className="mt-8 rounded border border-border bg-surface p-5">
              <p className="text-sm">
                A sign-in link is on its way to{" "}
                <span className="font-mono text-foreground">{email}</span>. Open it on this device to
                continue.
              </p>
              <button
                type="button"
                className="mono-label mt-4 hover:text-foreground"
                onClick={() => setLinkSent(false)}
              >
                use a different method
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 flex gap-1 rounded border border-border bg-surface p-1">
                {(
                  [
                    ["password", "password"],
                    ["magic", "magic link"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`flex-1 rounded-sm px-3 py-1.5 font-mono text-xs transition-colors ${
                      mode === value || (mode === "signup" && value === "password")
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {mode !== "magic" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full font-mono" disabled={busy}>
                  {busy
                    ? "working…"
                    : mode === "magic"
                      ? "email me a link"
                      : mode === "signup"
                        ? "create account"
                        : "sign in"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="mono-label">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full font-mono" onClick={google}>
                continue with google
              </Button>

              <button
                type="button"
                className="mono-label mt-8 hover:text-foreground"
                onClick={() => setMode(mode === "signup" ? "password" : "signup")}
              >
                {mode === "signup" ? "already registered? sign in" : "need an account? register"}
              </button>
            </>
          )}

          <BrandFooter branding={branding} />
        </div>
      </div>
    </div>
  );
}
