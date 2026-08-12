import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, Stat, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function Overview() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({}),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="mono-label">loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const c = data.counts;

  return (
    <>
      <PageHeader label="Core" title="Platform overview" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={c.accounts} />
        <Stat label="Legal Entities" value={c.entities} />
        <Stat label="Workspaces" value={c.workspaces} />
        <Stat label="Users" value={c.users} />
        <Stat label="Registered Apps" value={c.apps} />
        <Stat label="Canonical Contacts" value={c.contacts} />
        <Stat label="Messages" value={c.messages} />
        <Stat label="Suppressions" value={c.suppressions} tone="warn" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="panel p-4">
          <span className="mono-label">Carrier Provider</span>
          <p className="mt-2 text-sm">
            {data.providerConfigured ? (
              <span className="text-primary">credentials configured</span>
            ) : (
              <span className="text-destructive">not configured — sends return 503 provider_not_configured</span>
            )}
          </p>
          <p className="mono-label mt-2">
            stub provider {data.stubAllowed ? "allowed (CORE_ALLOW_STUB_PROVIDER=true)" : "disabled"}
          </p>
        </div>
        <div className="panel p-4">
          <span className="mono-label">Policy Denials by Rule</span>
          <div className="mt-3 space-y-1.5">
            {Object.keys(data.denyCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No denials recorded.</p>
            )}
            {Object.entries(data.denyCounts).map(([rule, count]) => (
              <div key={rule} className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">{rule}</span>
                <span className="text-destructive">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Recent Policy Checks">
          {data.recentChecks.length === 0 ? (
            <Empty>No policy checks yet.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Decision</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentChecks.map((r) => (
                  <tr key={r.id as string}>
                    <Td mono>
                      {r.action as string}
                      {r.channel ? `·${r.channel}` : ""}
                    </Td>
                    <Td mono>{`${r.actor_type} / ${r.app_id ?? "core"}`}</Td>
                    <Td>
                      <StatusTag value={r.decision as string} />{" "}
                      {r.denied_by ? <span className="mono-label">{r.denied_by as string}</span> : null}
                    </Td>
                    <Td mono>{fmt(r.created_at as string)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Recent Messages">
          {data.recentMessages.length === 0 ? (
            <Empty>No messages yet.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>To</Th>
                  <Th>Channel</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentMessages.map((m) => (
                  <tr key={m.id as string}>
                    <Td mono>{m.to_identifier as string}</Td>
                    <Td mono>{`${m.direction}·${m.channel}`}</Td>
                    <Td>
                      <StatusTag value={m.status as string} />{" "}
                      {m.error_code ? <span className="mono-label">{m.error_code as string}</span> : null}
                    </Td>
                    <Td mono>{fmt(m.created_at as string)}</Td>
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
