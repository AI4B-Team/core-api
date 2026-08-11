import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPolicyChecks } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/policy")({
  component: PolicyChecks,
});

const filters = ["all", "allow", "deny"] as const;

function PolicyChecks() {
  const fn = useServerFn(listPolicyChecks);
  const [decision, setDecision] = useState<string>("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-policy", decision],
    queryFn: () => fn({ data: { decision } }),
    refetchInterval: 20_000,
  });

  return (
    <>
      <PageHeader
        label="chokepoint"
        title="Policy checks"
        action={
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setDecision(f)}
                className={`rounded-sm border px-3 py-1.5 font-mono text-xs ${
                  decision === f ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      <Panel title="every regulated action, allow or deny">
        {isLoading ? (
          <Empty>loading…</Empty>
        ) : error ? (
          <Empty>{(error as Error).message}</Empty>
        ) : !data?.length ? (
          <Empty>No policy checks recorded.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>action</Th>
                <Th>identifier</Th>
                <Th>actor</Th>
                <Th>decision</Th>
                <Th>denied by</Th>
                <Th>rules</Th>
                <Th>when</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id as string}>
                  <Td mono>
                    {r.action as string}
                    {r.channel ? `·${r.channel}` : ""}
                  </Td>
                  <Td mono>{(r.identifier as string) ?? "—"}</Td>
                  <Td mono>{`${r.actor_type} / ${r.app_id ?? "core"}`}</Td>
                  <Td>
                    <StatusTag value={r.decision as string} />
                  </Td>
                  <Td mono>{(r.denied_by as string) ?? "—"}</Td>
                  <Td mono>
                    {Array.isArray(r.rules_evaluated)
                      ? (r.rules_evaluated as { rule: string; result: string }[])
                          .map((x) => `${x.rule}:${x.result}`)
                          .join(" ")
                      : "—"}
                  </Td>
                  <Td mono>{fmt(r.created_at as string)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
