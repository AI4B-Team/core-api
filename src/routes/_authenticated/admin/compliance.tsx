import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listBrands, listSuppressions } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, StatusTag, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/compliance")({
  component: Compliance,
});

function Compliance() {
  const brandsFn = useServerFn(listBrands);
  const suppressionsFn = useServerFn(listSuppressions);
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => brandsFn({}) });
  const suppressions = useQuery({ queryKey: ["admin-suppressions"], queryFn: () => suppressionsFn({}) });

  return (
    <>
      <PageHeader label="10dlc · suppression" title="Compliance" />

      <div className="grid gap-3">
        <Panel title="Brands">
          {!brands.data?.brands.length ? (
            <Empty>No brands registered.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Legal Entity</Th>
                  <Th>Vertical</Th>
                  <Th>Status</Th>
                  <Th>Tcr Brand ID</Th>
                  <Th>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {brands.data.brands.map((b) => (
                  <tr key={b.id as string}>
                    <Td>{(b.legal_entities as { legal_name?: string } | null)?.legal_name ?? "—"}</Td>
                    <Td mono>{(b.vertical as string) ?? "—"}</Td>
                    <Td>
                      <StatusTag value={b.status as string} />
                    </Td>
                    <Td mono>{(b.tcr_brand_id as string) ?? "—"}</Td>
                    <Td mono>{fmt(b.created_at as string)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Campaigns (10dlc)">
          {!brands.data?.campaigns.length ? (
            <Empty>No campaigns registered.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Use Case</Th>
                  <Th>Status</Th>
                  <Th>Provider Campaign ID</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {brands.data.campaigns.map((c) => (
                  <tr key={c.id as string}>
                    <Td mono>{(c.use_case as string) ?? "—"}</Td>
                    <Td>
                      <StatusTag value={c.status as string} />
                    </Td>
                    <Td mono>{(c.provider_campaign_id as string) ?? "—"}</Td>
                    <Td mono>{fmt(c.created_at as string)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Phone Numbers">
          {!brands.data?.numbers.length ? (
            <Empty>No numbers provisioned.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Capabilities</Th>
                  <Th>Status</Th>
                  <Th>Provisioned</Th>
                </tr>
              </thead>
              <tbody>
                {brands.data.numbers.map((n) => (
                  <tr key={n.id as string}>
                    <Td mono>{n.e164 as string}</Td>
                    <Td mono>{((n.capabilities as string[]) ?? []).join(", ") || "—"}</Td>
                    <Td>
                      <StatusTag value={n.status as string} />
                    </Td>
                    <Td mono>{fmt(n.provisioned_at as string)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Suppressions">
          {!suppressions.data?.length ? (
            <Empty>No suppressions recorded.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Identifier</Th>
                  <Th>Channel</Th>
                  <Th>Legal Entity</Th>
                  <Th>Reason</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {suppressions.data.map((s) => (
                  <tr key={s.id as string}>
                    <Td mono>{s.identifier as string}</Td>
                    <Td mono>{s.channel as string}</Td>
                    <Td>{(s.legal_entities as { legal_name?: string } | null)?.legal_name ?? "—"}</Td>
                    <Td mono>{s.reason as string}</Td>
                    <Td mono>{fmt(s.created_at as string)}</Td>
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
