import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listContacts } from "@/lib/core/admin.functions";
import { Empty, PageHeader, Panel, Td, Th, fmt } from "@/components/console/primitives";

export const Route = createFileRoute("/_authenticated/admin/contacts")({
  component: Contacts,
});

function Contacts() {
  const fn = useServerFn(listContacts);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-contacts"], queryFn: () => fn({}) });

  return (
    <>
      <PageHeader label="canonical" title="Contacts" />
      <Panel title="one person per legal entity, deduped on identifier">
        {isLoading ? (
          <Empty>loading…</Empty>
        ) : error ? (
          <Empty>{(error as Error).message}</Empty>
        ) : !data?.length ? (
          <Empty>No contacts yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>name</Th>
                <Th>company</Th>
                <Th>phones</Th>
                <Th>emails</Th>
                <Th>timezone</Th>
                <Th>updated</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const phones = (c.contact_phones as { e164: string; line_type: string | null }[]) ?? [];
                const emails = (c.contact_emails as { email: string }[]) ?? [];
                return (
                  <tr key={c.id as string}>
                    <Td>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </Td>
                    <Td>{(c.company as string) ?? "—"}</Td>
                    <Td mono>
                      {phones.length
                        ? phones.map((p) => `${p.e164}${p.line_type ? `(${p.line_type})` : ""}`).join(", ")
                        : "—"}
                    </Td>
                    <Td mono>{emails.length ? emails.map((e) => e.email).join(", ") : "—"}</Td>
                    <Td mono>{(c.timezone as string) ?? "—"}</Td>
                    <Td mono>{fmt(c.updated_at as string)}</Td>
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
