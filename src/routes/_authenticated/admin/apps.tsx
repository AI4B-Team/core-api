import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAppCredential,
  listApps,
  revokeAppCredential,
  updateAppBaseUrl,
  updateAppRedirectUris,
} from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/apps")({
  component: Apps,
});

function Apps() {
  const fn = useServerFn(listApps);
  const create = useServerFn(createAppCredential);
  const revoke = useServerFn(revokeAppCredential);
  const setBaseUrl = useServerFn(updateAppBaseUrl);
  const setRedirects = useServerFn(updateAppRedirectUris);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-apps"], queryFn: () => fn({}) });

  const [issued, setIssued] = useState<{ app_id: string; token: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [editingRedirects, setEditingRedirects] = useState<{ id: string; value: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-apps"] });

  const createMut = useMutation({
    mutationFn: (v: { app_id: string; name: string }) => create({ data: v }),
    onSuccess: (res, v) => {
      setIssued({ app_id: v.app_id, token: res.token });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Credential revoked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const urlMut = useMutation({
    mutationFn: (v: { app_id: string; base_url: string }) => setBaseUrl({ data: v }),
    onSuccess: () => {
      toast.success("Base URL Updated");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const redirectMut = useMutation({
    mutationFn: (v: { app_id: string; redirect_uris: string[] }) => setRedirects({ data: v }),
    onSuccess: () => {
      toast.success("Redirect URIs Updated");
      setEditingRedirects(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading) return <p className="mono-label">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  function issue(appId: string) {
    const name = window.prompt("Credential name (e.g. production server)");
    if (name === null) return;
    createMut.mutate({ app_id: appId, name: name.trim() || "service credential" });
  }

  return (
    <>
      <PageHeader label="Registry" title="Apps and Service Credentials" />

      {issued && (
        <section className="panel mb-3 border-warning/50 p-4">
          <span className="mono-label text-warning">
            new credential for {issued.app_id} — shown once
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            Copy this token now. It is hashed at rest and will never be displayed again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="break-all rounded-sm border border-border bg-accent px-3 py-2 font-mono text-xs">
              {issued.token}
            </code>
            <button
              className="mono-label hover:text-foreground"
              onClick={async () => {
                await navigator.clipboard.writeText(issued.token);
                toast.success("Copied to clipboard");
              }}
            >
              Copy
            </button>
            <button className="mono-label hover:text-foreground" onClick={() => setIssued(null)}>
              Dismiss
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-3">
        <Panel title="Registered Apps">
          {!data?.apps.length ? (
            <Empty>No apps registered.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>App ID</Th>
                  <Th>Name</Th>
                  <Th>Base URL</Th>
                  <Th>Redirect URIs</Th>
                  <Th>à la carte</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.apps.map((a) => {
                  const id = a.id as string;
                  const isEditing = editing?.id === id;
                  const manifest = (a.manifest as Record<string, unknown> | null) ?? {};
                  const uris = Array.isArray(manifest["redirect_uris"])
                    ? (manifest["redirect_uris"] as string[])
                    : [];
                  const isEditingUris = editingRedirects?.id === id;
                  return (
                    <tr key={id}>
                      <Td mono>{id}</Td>
                      <Td>{a.name as string}</Td>
                      <Td mono>
                        {isEditing ? (
                          <span className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editing.value}
                              onChange={(e) => setEditing({ id, value: e.target.value })}
                              className="w-64 rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs"
                              placeholder="https://app.realelite.com"
                            />
                            <button
                              className="mono-label hover:text-foreground"
                              onClick={() => urlMut.mutate({ app_id: id, base_url: editing.value })}
                            >
                              Save
                            </button>
                            <button
                              className="mono-label hover:text-foreground"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="text-left hover:text-primary"
                            onClick={() => setEditing({ id, value: (a.base_url as string) ?? "" })}
                          >
                            {(a.base_url as string) || "—"}
                          </button>
                        )}
                      </Td>
                      <Td mono>
                        {isEditingUris ? (
                          <span className="flex items-start gap-2">
                            <textarea
                              autoFocus
                              rows={3}
                              value={editingRedirects.value}
                              onChange={(e) => setEditingRedirects({ id, value: e.target.value })}
                              className="w-72 rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs"
                              placeholder="https://app.example.com/api/public/core/callback"
                            />
                            <button
                              className="mono-label hover:text-foreground"
                              onClick={() =>
                                redirectMut.mutate({
                                  app_id: id,
                                  redirect_uris: editingRedirects.value.split(/[\n,]/),
                                })
                              }
                            >
                              Save
                            </button>
                            <button
                              className="mono-label hover:text-foreground"
                              onClick={() => setEditingRedirects(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="text-left hover:text-primary"
                            onClick={() => setEditingRedirects({ id, value: uris.join("\n") })}
                          >
                            {uris.length ? (
                              <span className="block whitespace-pre-line">{uris.join("\n")}</span>
                            ) : (
                              "—"
                            )}
                          </button>
                        )}
                      </Td>
                      <Td mono>{a.is_alacarte ? "yes" : "no"}</Td>
                      <Td>
                        <StatusTag value={a.is_active ? "active" : "disabled"} />
                      </Td>
                      <Td>
                        <button
                          className="mono-label hover:text-foreground"
                          disabled={createMut.isPending}
                          onClick={() => issue(id)}
                        >
                          Issue Credential
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Service Credentials">
          {!data?.credentials.length ? (
            <Empty>No credentials issued.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>App</Th>
                  <Th>Name</Th>
                  <Th>Prefix</Th>
                  <Th>Created</Th>
                  <Th>Last Used</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.credentials.map((c) => (
                  <tr key={c.id as string}>
                    <Td mono>{c.app_id as string}</Td>
                    <Td>{c.name as string}</Td>
                    <Td mono>{`${c.token_prefix}…`}</Td>
                    <Td mono>{fmt(c.created_at as string)}</Td>
                    <Td mono>{fmt(c.last_used_at as string)}</Td>
                    <Td>
                      <StatusTag value={c.is_active ? "active" : "revoked"} />
                    </Td>
                    <Td>
                      {c.is_active ? (
                        <button
                          className="mono-label hover:text-destructive"
                          disabled={revokeMut.isPending}
                          onClick={() => {
                            if (window.confirm("Revoke this credential? Calls using it will fail."))
                              revokeMut.mutate(c.id as string);
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="mono-label">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
