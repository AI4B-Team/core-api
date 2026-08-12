import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAccount,
  createLegalEntity,
  createWorkspace,
  listOrgTree,
  listWorkspaces,
} from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/workspaces/")({
  component: Workspaces,
});

type Form = "account" | "entity" | "workspace" | null;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono-label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Workspaces() {
  const fn = useServerFn(listWorkspaces);
  const tree = useServerFn(listOrgTree);
  const addAccount = useServerFn(createAccount);
  const addEntity = useServerFn(createLegalEntity);
  const addWorkspace = useServerFn(createWorkspace);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-workspaces"], queryFn: () => fn({}) });
  const { data: org } = useQuery({ queryKey: ["admin-org-tree"], queryFn: () => tree({}) });

  const [form, setForm] = useState<Form>(null);
  const [acct, setAcct] = useState({ name: "", type: "direct", billing_email: "" });
  const [entity, setEntity] = useState({ account_id: "", legal_name: "", ein: "", entity_type: "LLC" });
  const [ws, setWs] = useState({
    account_id: "",
    legal_entity_id: "",
    name: "",
    slug: "",
    timezone: "America/New_York",
    industry: "",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
    qc.invalidateQueries({ queryKey: ["admin-org-tree"] });
  };

  const acctMut = useMutation({
    mutationFn: () => addAccount({ data: acct }),
    onSuccess: () => {
      toast.success("Account Created");
      setAcct({ name: "", type: "direct", billing_email: "" });
      setForm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entityMut = useMutation({
    mutationFn: () => addEntity({ data: entity }),
    onSuccess: () => {
      toast.success("Legal Entity Created");
      setEntity({ account_id: entity.account_id, legal_name: "", ein: "", entity_type: "LLC" });
      setForm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wsMut = useMutation({
    mutationFn: () => addWorkspace({ data: ws }),
    onSuccess: (row) => {
      toast.success(`Workspace Created — ${row?.id ?? ""}`);
      setForm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entitiesForAccount = (org?.entities ?? []).filter((e) => e.account_id === ws.account_id);

  if (isLoading) return <p className="mono-label">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <>
      <PageHeader label="Identity" title="Workspaces" />

      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setForm(form === "account" ? null : "account")}>
          New Account
        </button>
        <button className="btn-secondary" onClick={() => setForm(form === "entity" ? null : "entity")}>
          New Legal Entity
        </button>
        <button className="btn-secondary" onClick={() => setForm(form === "workspace" ? null : "workspace")}>
          New Workspace
        </button>
      </div>

      {form === "account" && (
        <Panel title="New Account">
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <Field label="Name">
              <input className={inputClass} value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={acct.type} onChange={(e) => setAcct({ ...acct, type: e.target.value })}>
                <option value="direct">Direct</option>
                <option value="reseller">Reseller</option>
              </select>
            </Field>
            <Field label="Billing Email">
              <input
                className={inputClass}
                value={acct.billing_email}
                onChange={(e) => setAcct({ ...acct, billing_email: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button className="btn-primary" disabled={acctMut.isPending} onClick={() => acctMut.mutate()}>
              Create Account
            </button>
            <button className="mono-label hover:text-foreground" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {form === "entity" && (
        <Panel title="New Legal Entity">
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <Field label="Account">
              <select
                className={inputClass}
                value={entity.account_id}
                onChange={(e) => setEntity({ ...entity, account_id: e.target.value })}
              >
                <option value="">Select…</option>
                {(org?.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Legal Name">
              <input
                className={inputClass}
                value={entity.legal_name}
                onChange={(e) => setEntity({ ...entity, legal_name: e.target.value })}
              />
            </Field>
            <Field label="EIN">
              <input className={inputClass} value={entity.ein} onChange={(e) => setEntity({ ...entity, ein: e.target.value })} />
            </Field>
            <Field label="Entity Type">
              <input
                className={inputClass}
                value={entity.entity_type}
                onChange={(e) => setEntity({ ...entity, entity_type: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button className="btn-primary" disabled={entityMut.isPending} onClick={() => entityMut.mutate()}>
              Create Legal Entity
            </button>
            <button className="mono-label hover:text-foreground" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {form === "workspace" && (
        <Panel title="New Workspace">
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <Field label="Account">
              <select
                className={inputClass}
                value={ws.account_id}
                onChange={(e) => setWs({ ...ws, account_id: e.target.value, legal_entity_id: "" })}
              >
                <option value="">Select…</option>
                {(org?.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Legal Entity">
              <select
                className={inputClass}
                value={ws.legal_entity_id}
                onChange={(e) => setWs({ ...ws, legal_entity_id: e.target.value })}
              >
                <option value="">Select…</option>
                {entitiesForAccount.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.legal_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <input className={inputClass} value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} />
            </Field>
            <Field label="Slug">
              <input className={inputClass} value={ws.slug} onChange={(e) => setWs({ ...ws, slug: e.target.value })} />
            </Field>
            <Field label="Timezone">
              <input className={inputClass} value={ws.timezone} onChange={(e) => setWs({ ...ws, timezone: e.target.value })} />
            </Field>
            <Field label="Industry">
              <input className={inputClass} value={ws.industry} onChange={(e) => setWs({ ...ws, industry: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button className="btn-primary" disabled={wsMut.isPending} onClick={() => wsMut.mutate()}>
              Create Workspace
            </button>
            <button className="mono-label hover:text-foreground" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      <Panel title={`${data?.length ?? 0} workspaces`}>
        {!data?.length ? (
          <Empty>No workspaces provisioned yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Workspace</Th>
                <Th>Account</Th>
                <Th>Legal Entity</Th>
                <Th>Brand</Th>
                <Th>Timezone</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((w) => {
                const le = w.legal_entities as { legal_name?: string; brand_status?: string } | null;
                const acctRow = w.accounts as { name?: string; status?: string } | null;
                return (
                  <tr key={w.id as string} className="hover:bg-accent/40">
                    <Td>
                      <Link
                        to="/admin/workspaces/$workspaceId"
                        params={{ workspaceId: w.id as string }}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {w.name as string}
                      </Link>
                      <span className="mono-label block">{w.slug as string}</span>
                    </Td>
                    <Td>
                      {acctRow?.name ?? "—"} <StatusTag value={acctRow?.status} />
                    </Td>
                    <Td>{le?.legal_name ?? "—"}</Td>
                    <Td>
                      <StatusTag value={le?.brand_status} />
                    </Td>
                    <Td mono>{w.timezone as string}</Td>
                    <Td mono>{fmt(w.created_at as string)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
