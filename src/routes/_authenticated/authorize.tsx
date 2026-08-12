import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAuthorizeContext, issueAuthCode } from "@/lib/core/authorize.functions";
import { BrandFooter, BrandMark } from "@/components/console/auth-brand";
import type { CoreBranding } from "@/lib/core/branding.functions";

export const Route = createFileRoute("/_authenticated/authorize")({
  head: () => ({
    meta: [
      { title: "Choose A Workspace — Real Elite" },
      { name: "description", content: "Grant a Real Elite application access to one of your workspaces." },
      { property: "og:title", content: "Choose A Workspace — Real Elite" },
      { property: "og:description", content: "Pick the workspace an application may act inside." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    app_id: typeof search["app_id"] === "string" ? (search["app_id"] as string) : "",
    redirect_uri: typeof search["redirect_uri"] === "string" ? (search["redirect_uri"] as string) : "",
    state: typeof search["state"] === "string" ? (search["state"] as string) : undefined,
  }),
  component: Authorize,
});

function Authorize() {
  const { app_id, redirect_uri, state } = useSearch({ from: "/_authenticated/authorize" });
  const navigate = useNavigate();
  const fetchContext = useServerFn(getAuthorizeContext);
  const issue = useServerFn(issueAuthCode);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["authorize", app_id],
    queryFn: () => fetchContext({ data: { appId: app_id } }),
    enabled: Boolean(app_id),
  });

  const branding = (data?.branding ?? null) as CoreBranding | null;

  const grant = useMutation({
    mutationFn: (workspaceId: string) =>
      issue({ data: { appId: app_id, workspaceId, redirectUri: redirect_uri } }),
    onSuccess: (res) => {
      const url = new URL(res.redirectTo);
      if (state) url.searchParams.set("state", state);
      window.location.href = url.toString();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Authorization failed"),
  });

  if (!app_id || !redirect_uri) {
    return (
      <Shell branding={branding}>
        <p className="text-sm text-destructive">Missing app_id or redirect_uri.</p>
      </Shell>
    );
  }

  if (isLoading)
    return (
      <Shell branding={branding}>
        <p className="mono-label">Loading…</p>
      </Shell>
    );

  if (!data?.app) {
    return (
      <Shell branding={branding}>
        <p className="text-sm text-destructive">Unknown application “{app_id}”.</p>
      </Shell>
    );
  }

  let targetHost = redirect_uri;
  try {
    targetHost = new URL(redirect_uri).host;
  } catch {
    return (
      <Shell branding={branding}>
        <p className="text-sm text-destructive">Invalid redirect_uri.</p>
      </Shell>
    );
  }

  const workspaces = data.workspaces;
  const entitledCount = workspaces.filter((w) => w.entitled).length;

  return (
    <Shell branding={branding}>
      <p className="mono-label">Choose Workspace</p>
      <h1 className="mt-3 text-2xl font-semibold">Continue To {data.app.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick the workspace {data.app.name} should work inside. You will be returned to{" "}
        <span className="font-mono text-foreground">{targetHost}</span> with a single-use code.
      </p>

      <div className="mt-6 space-y-2">
        {workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground">You are not a member of any workspace yet.</p>
        )}
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            disabled={!ws.entitled}
            onClick={() => setSelected(ws.id)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              selected === ws.id ? "border-primary bg-accent" : "border-border bg-surface"
            } ${ws.entitled ? "hover:bg-accent" : "cursor-not-allowed opacity-50"}`}
          >
            <span>
              <span className="block text-sm font-medium">{ws.name}</span>
              <span className="mono-label">
                {ws.accountName ? `${ws.accountName} · ` : ""}
                {ws.slug} · {ws.role}
              </span>
            </span>
            <span className="mono-label">{ws.entitled ? (ws.plan ?? "Entitled") : "Not Entitled"}</span>
          </button>
        ))}
      </div>

      {workspaces.length > 0 && entitledCount === 0 && (
        <p className="mt-4 text-sm text-destructive">
          None of your workspaces are entitled to {data.app.name}.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Button
          className="font-semibold"
          disabled={!selected || grant.isPending}
          onClick={() => selected && grant.mutate(selected)}
        >
          {grant.isPending ? "Issuing…" : "Continue"}
        </Button>
        <Button variant="outline" className="font-semibold" onClick={() => navigate({ to: "/" })}>
          Cancel
        </Button>
      </div>

      <BrandFooter branding={branding} />
    </Shell>
  );
}

function Shell({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: CoreBranding | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="panel w-full max-w-md p-8">
        <div className="mb-6">
          <BrandMark branding={branding} />
        </div>
        {children}
      </div>
    </div>
  );
}
