import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureCoreUser } from "@/lib/core/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Core console — internal operations" },
      { name: "description", content: "Internal Core console for identity, entitlements, policy decisions, messaging and credits." },
      { property: "og:title", content: "Core console — internal operations" },
      { property: "og:description", content: "Staff view over the Real Elite platform backbone." },
    ],
  }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "overview", exact: true },
  { to: "/admin/workspaces", label: "workspaces" },
  { to: "/admin/apps", label: "apps" },
  { to: "/admin/contacts", label: "contacts" },
  { to: "/admin/policy", label: "policy" },
  { to: "/admin/messaging", label: "messaging" },
  { to: "/admin/compliance", label: "compliance" },
] as const;

function AdminLayout() {
  const ensure = useServerFn(ensureCoreUser);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useQuery({ queryKey: ["core-user"], queryFn: () => ensure({}) });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-primary" />
            <span className="font-mono text-sm font-medium">core console</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-sm px-3 py-1.5 font-mono text-xs transition-colors ${
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
              {me?.email ?? ""} {me?.is_staff ? "· staff" : ""}
            </span>
            <button
              className="mono-label hover:text-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className="mono-label whitespace-nowrap px-2">
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
