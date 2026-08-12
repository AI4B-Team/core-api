import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureCoreUser } from "@/lib/core/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Core Console — Internal Operations" },
      { name: "description", content: "Internal Core console for identity, entitlements, policy decisions, messaging and credits." },
      { property: "og:title", content: "Core Console — Internal Operations" },
      { property: "og:description", content: "Staff view over the Real Elite platform backbone." },
    ],
  }),
  component: AdminLayout,
});

const nav: { to: string; label: string; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/workspaces", label: "Workspaces" },
  { to: "/admin/apps", label: "Apps" },
  { to: "/admin/contacts", label: "Contacts" },
  { to: "/admin/policy", label: "Policy" },
  { to: "/admin/messaging", label: "Messaging" },
  { to: "/admin/compliance", label: "Compliance" },
];

function AdminLayout() {
  const ensure = useServerFn(ensureCoreUser);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["core-user"],
    queryFn: () => ensure({}),
  });

  useEffect(() => {
  }, []);

  if (meLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="mono-label">Checking Access…</span>
      </div>
    );
  }

  if (!me?.is_staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="panel w-full max-w-md p-8">
          <p className="mono-label">403</p>
          <h1 className="mt-3 text-2xl font-semibold">Staff Access Only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The Core console is internal. Your account is signed in as{" "}
            <span className="font-mono text-foreground">{me?.email ?? "unknown"}</span> but is not
            marked as staff.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Back To Core
            </Link>
            <button
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-primary" />
            <span className="font-display text-base font-extrabold tracking-tight">Core Console</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="mono-label hidden sm:inline">
              {me?.email ?? ""} {me?.is_staff ? "· Staff" : ""}
            </span>
            <button
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className="whitespace-nowrap px-2 text-sm font-semibold text-muted-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
