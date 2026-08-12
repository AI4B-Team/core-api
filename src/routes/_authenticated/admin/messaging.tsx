import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMessages } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  component: Messaging,
});

function Messaging() {
  const fn = useServerFn(listMessages);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => fn({}),
    refetchInterval: 20_000,
  });

  return (
    <>
      <PageHeader label="Communications" title="Messages" />
      <Panel title="Outbound and Inbound Traffic">
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : error ? (
          <Empty>{(error as Error).message}</Empty>
        ) : !data?.length ? (
          <Empty>No messages yet. Sends fail closed while no provider is configured.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Direction</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Body</Th>
                <Th>Status</Th>
                <Th>Error</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id as string}>
                  <Td mono>{`${m.direction}·${m.channel}`}</Td>
                  <Td mono>{(m.from_identifier as string) ?? "—"}</Td>
                  <Td mono>{(m.to_identifier as string) ?? "—"}</Td>
                  <Td>
                    <span className="line-clamp-1 max-w-[24ch] text-muted-foreground">
                      {(m.body as string) ?? ""}
                    </span>
                  </Td>
                  <Td>
                    <StatusTag value={m.status as string} />
                  </Td>
                  <Td mono>{(m.error_code as string) ?? "—"}</Td>
                  <Td mono>{fmt(m.created_at as string)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
