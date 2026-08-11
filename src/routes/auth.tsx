import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safePath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/admin";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Core" },
      { name: "description", content: "Sign in to Core, the Real Elite identity and compliance service." },
      { property: "og:title", content: "Sign in — Core" },
      { property: "og:description", content: "Centralized identity for every Real Elite application." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const next = safePath(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: next });
    });
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
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
        toast.success("Account created. Signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: next });
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="grid-bg hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-2.5 rounded-full bg-primary" />
          <span className="font-mono text-sm font-medium">core</span>
        </div>
        <div>
          <h2 className="max-w-sm text-3xl leading-tight font-semibold">
            One identity across every Real Elite application.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Core issues the tokens, holds the memberships and decides what each workspace is
            entitled to run.
          </p>
        </div>
        <span className="mono-label">auth.realelite.com</span>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mono-label">{mode === "signin" ? "sign in" : "create account"}</p>
          <h1 className="mt-3 text-2xl font-semibold">
            {mode === "signin" ? "Access Core" : "Register with Core"}
          </h1>

          <form onSubmit={submit} className="mt-8 space-y-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full font-mono" disabled={busy}>
              {busy ? "working…" : mode === "signin" ? "sign in" : "create account"}
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
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "need an account? register" : "already registered? sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
