import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAuthorizeContext, issueAuthCode } from "@/lib/core/authorize.functions";

export const Route = createFileRoute("/_authenticated/authorize")({
  head: () => ({
    meta: [
      { title: "Authorize app access — Core" },
      { name: "description", content: "Grant a Real Elite application access to one of your Core workspaces." },
      { property: "og:title", content: "Authorize app access — Core" },
      { property: "og:description", content: "Choose the workspace an application may act inside." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    app_id: typeof search["app_id"] === "string" ? (search["app_id"] as string) : "",
    redirect_uri: typeof search["redirect_uri"] === "string" ? (search["redirect_uri"] as string) : "",
  }),
  component: Authorize,
});

function Authorize() {
  const { app_id, redirect_uri } = useSearch({ from: "/_authenticated/authorize" });
  const navigate = useNavigate();
  const fetchContext = useServerFn(getAuthorizeContext);
  const issue = useServerFn(issueAuthCode);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["authorize", app_id],
    queryFn: () => fetchContext({ data: { appId: app_id } }),
    enabled: Boolean(app_id),
  });

  const grant = useMutation({
    mutationFn: (workspaceId: string) =>
      issue({ data: { appId: app_id, workspaceId, redirectUri: redirect_uri } }),
    onSuccess: (res) => {
      window.location.href = res.redirectTo;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Authorization failed"),
  });

  if (!app_id || !redirect_uri) {
    return (
      <Shell>
        <p className="text-sm text-destructive">Missing app_id or redirect_uri.</p>
      </Shell>
    );
  }

  if (isLoading) return <Shell><p className="mono-label">loading…</p></Shell>;

  if (!data?.app) {
    return (
      <Shell>
        <p className="text-sm text-destructive">Unknown application “{app_id}”.</p>
      </Shell>
    );
  }

  const target = new URL(redirect_uri);

  return (
    <Shell>
      <p className="mono-label">authorize</p>
      <h1 className="mt-3 text-2xl font-semibold">{data.app.name} wants access to a workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Core will issue a scoped token for the workspace you choose and return the user to{" "}
        <span className="font-mono text-foreground">{target.host}</span>.
      </p>

      <div className="mt-6 space-y-2">
        {data.workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground">You are not a member of any workspace yet.</p>
        )}
        {data.workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            disabled={!ws.entitled}
            onClick={() => setSelected(ws.id)}
            className={`flex w-full items-center justify-between rounded border px-4 py-3 text-left transition-colors ${
              selected === ws.id ? "border-primary bg-accent" : "border-border bg-surface"
            } ${ws.entitled ? "hover:bg-accent" : "cursor-not-allowed opacity-50"}`}
          >
            <span>
              <span className="block text-sm font-medium">{ws.name}</span>
              <span className="mono-label">
                {ws.slug} · {ws.role}
              </span>
            </span>
            <span className="mono-label">{ws.entitled ? (ws.plan ?? "entitled") : "not entitled"}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button
          className="font-mono"
          disabled={!selected || grant.isPending}
          onClick={() => selected && grant.mutate(selected)}
        >
          {grant.isPending ? "issuing…" : "authorize"}
        </Button>
        <Button variant="outline" className="font-mono" onClick={() => navigate({ to: "/admin" })}>
          cancel
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md panel p-8">{children}</div>
    </div>
  );
}
