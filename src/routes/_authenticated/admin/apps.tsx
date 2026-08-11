import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listApps } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/apps")({
  component: Apps,
});

function Apps() {
  const fn = useServerFn(listApps);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-apps"], queryFn: () => fn({}) });

  if (isLoading) return <p className="mono-label">loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <>
      <PageHeader label="registry" title="Apps and service credentials" />

      <div className="grid gap-3">
        <Panel title="registered apps">
          {!data?.apps.length ? (
            <Empty>No apps registered.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>app id</Th>
                  <Th>name</Th>
                  <Th>base url</Th>
                  <Th>à la carte</Th>
                  <Th>status</Th>
                </tr>
              </thead>
              <tbody>
                {data.apps.map((a) => (
                  <tr key={a.id as string}>
                    <Td mono>{a.id as string}</Td>
                    <Td>{a.name as string}</Td>
                    <Td mono>{a.base_url as string}</Td>
                    <Td mono>{a.is_alacarte ? "yes" : "no"}</Td>
                    <Td>
                      <StatusTag value={a.is_active ? "active" : "disabled"} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="service credentials">
          {!data?.credentials.length ? (
            <Empty>No credentials issued.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>app</Th>
                  <Th>name</Th>
                  <Th>prefix</Th>
                  <Th>last used</Th>
                  <Th>status</Th>
                </tr>
              </thead>
              <tbody>
                {data.credentials.map((c) => (
                  <tr key={c.id as string}>
                    <Td mono>{c.app_id as string}</Td>
                    <Td>{c.name as string}</Td>
                    <Td mono>{`${c.token_prefix}…`}</Td>
                    <Td mono>{fmt(c.last_used_at as string)}</Td>
                    <Td>
                      <StatusTag value={c.is_active ? "active" : "revoked"} />
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
