import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listWorkspaces } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/workspaces/")({
  component: Workspaces,
});

function Workspaces() {
  const fn = useServerFn(listWorkspaces);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-workspaces"], queryFn: () => fn({}) });

  if (isLoading) return <p className="mono-label">loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <>
      <PageHeader label="identity" title="Workspaces" />
      <Panel title={`${data?.length ?? 0} workspaces`}>
        {!data?.length ? (
          <Empty>No workspaces provisioned yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>workspace</Th>
                <Th>account</Th>
                <Th>legal entity</Th>
                <Th>brand</Th>
                <Th>timezone</Th>
                <Th>created</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((w) => {
                const le = w.legal_entities as { legal_name?: string; brand_status?: string } | null;
                const acct = w.accounts as { name?: string; status?: string } | null;
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
                      {acct?.name ?? "—"} <StatusTag value={acct?.status} />
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
