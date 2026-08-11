import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Core — identity, compliance and comms for Real Elite" },
      {
        name: "description",
        content:
          "Core is the single service that owns accounts, legal entities, workspaces, contacts, the policy engine and credits for every Real Elite application.",
      },
      { property: "og:title", content: "Core — identity, compliance and comms for Real Elite" },
      {
        property: "og:description",
        content: "One service. One database. Every Real Elite app depends on it.",
      },
    ],
  }),
  component: Index,
});

const surfaces = [
  {
    code: "01",
    name: "Identity",
    body: "Accounts, legal entities, workspaces, users and memberships. Core issues every token the ecosystem trusts.",
  },
  {
    code: "02",
    name: "Registry",
    body: "Apps register a manifest. Entitlements decide which workspace may run which app, on which plan.",
  },
  {
    code: "03",
    name: "Contacts",
    body: "One canonical person per legal entity. Upsert by phone or email, dedupe on the identifier, never twice.",
  },
  {
    code: "04",
    name: "Policy",
    body: "Suppression, quiet hours, line type, frequency caps and brand status. Every regulated action passes through.",
  },
  {
    code: "05",
    name: "Messaging",
    body: "10DLC brands, campaigns, numbers, conversations and messages. Nothing sends without a policy allow.",
  },
  {
    code: "06",
    name: "Credits",
    body: "Meters, balances and an idempotent ledger. Refunds are entries, never deletions.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-primary" />
            <span className="font-mono text-sm font-medium tracking-tight">core</span>
            <span className="mono-label hidden sm:inline">realelite platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/auth"
              search={{ redirect: undefined, app_id: undefined, account: undefined }}
              className="mono-label hover:text-foreground"
            >
              sign in
            </Link>
            <Link
              to="/admin"
              className="rounded-sm bg-primary px-3 py-1.5 font-mono text-xs font-medium text-primary-foreground"
            >
              console
            </Link>
          </div>
        </div>
      </header>

      <section className="grid-bg border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="mono-label">infrastructure · not a product</p>
          <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
            The service every Real Elite app is built on top of.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground">
            Core owns identity, entitlements, canonical contacts, compliance decisions and credits.
            Apps hold workflow. Nothing regulated happens without asking Core first.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/admin"
              className="rounded-sm bg-primary px-5 py-2.5 font-mono text-sm font-medium text-primary-foreground"
            >
              open console
            </Link>
            <a
              href="#surfaces"
              className="rounded-sm border border-border px-5 py-2.5 font-mono text-sm text-foreground hover:bg-accent"
            >
              what it owns
            </a>
          </div>
        </div>
      </section>

      <section id="surfaces" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {surfaces.map((s) => (
            <div key={s.code} className="bg-surface p-6">
              <span className="font-mono text-xs text-primary">{s.code}</span>
              <h2 className="mt-3 text-lg font-semibold">{s.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="mono-label">the chokepoint</p>
          <pre className="mt-4 overflow-x-auto rounded border border-border bg-surface p-5 font-mono text-xs leading-relaxed text-muted-foreground">
{`POST /api/public/v1/messages/send
  -> policy.assertCanSend(workspace, contact, channel)
       suppression · quiet hours · line type · frequency cap · brand status
  -> deny  => 403 policy_denied            (logged to policy_checks)
  -> allow => provider
       no credentials => 503 provider_not_configured
                         messages.status = 'failed'
                         messages.error_code = 'no_provider'`}
          </pre>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            The carrier stub never fabricates a successful send. Without provider credentials the
            send path fails loudly and records the failure.
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8">
          <span className="mono-label">core · api.realelite.com</span>
          <span className="mono-label">auth.realelite.com</span>
        </div>
      </footer>
    </div>
  );
}
