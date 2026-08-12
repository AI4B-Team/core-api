import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceDetail } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, Stat, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/workspaces/$workspaceId")({
  component: WorkspaceDetail,
});

function WorkspaceDetail() {
  const { workspaceId } = useParams({ from: "/_authenticated/admin/workspaces/$workspaceId" });
  const fn = useServerFn(getWorkspaceDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-workspace", workspaceId],
    queryFn: () => fn({ data: { workspaceId } }),
  });

  if (isLoading) return <p className="mono-label">loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  const ws = data?.workspace as Record<string, unknown> | null;
  if (!ws) return <p className="text-sm text-muted-foreground">Workspace not found.</p>;

  const le = ws["legal_entities"] as Record<string, unknown> | null;
  const acct = ws["accounts"] as Record<string, unknown> | null;

  return (
    <>
      <PageHeader label={(ws["slug"] as string) ?? "workspace"} title={(ws["name"] as string) ?? ""} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Account" value={(acct?.["name"] as string) ?? "—"} />
        <Stat label="Legal Entity" value={(le?.["legal_name"] as string) ?? "—"} />
        <Stat label="Brand Status" value={(le?.["brand_status"] as string) ?? "—"} />
        <Stat label="Autonomy Level" value={String(data?.policy?.autonomy_level ?? "default")} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Entitlements">
          {!data?.entitlements.length ? (
            <Empty>No apps entitled.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>App</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.entitlements.map((e) => (
                  <tr key={e.id as string}>
                    <Td mono>{e.app_id as string}</Td>
                    <Td mono>{(e.plan as string) ?? "—"}</Td>
                    <Td>
                      <StatusTag value={e.status as string} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Credit Balances">
          {!data?.balances.length ? (
            <Empty>No meters funded.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Meter</Th>
                  <Th>Balance</Th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map((b) => (
                  <tr key={b.meter_id as string}>
                    <Td mono>{b.meter_id as string}</Td>
                    <Td mono>{String(b.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Members">
          {!data?.members.length ? (
            <Empty>No members.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m, i) => {
                  const u = m.users as { email?: string; full_name?: string } | null;
                  return (
                    <tr key={i}>
                      <Td>{u?.full_name ?? u?.email ?? "—"}</Td>
                      <Td mono>{m.role as string}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Credit Ledger">
          {!data?.ledger.length ? (
            <Empty>No ledger entries.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Meter</Th>
                  <Th>Qty</Th>
                  <Th>App</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.map((l) => (
                  <tr key={l.id as string}>
                    <Td mono>{l.meter_id as string}</Td>
                    <Td mono>{String(l.quantity)}</Td>
                    <Td mono>{(l.app_id as string) ?? "core"}</Td>
                    <Td mono>{fmt(l.created_at as string)}</Td>
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
