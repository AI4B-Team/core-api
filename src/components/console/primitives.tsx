import type { ReactNode } from "react";

export function PageHeader({ label, title, action }: { label: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="mono-label">{label}</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      {title && (
        <header className="border-b border-border px-4 py-2.5">
          <span className="mono-label">{title}</span>
        </header>
      )}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "deny" }) {
  return (
    <div className="panel p-4">
      <span className="mono-label">{label}</span>
      <p
        className={`mt-2 font-mono text-2xl ${
          tone === "deny" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function StatusTag({ value }: { value: string | null | undefined }) {
  const v = (value ?? "unknown").toLowerCase();
  const tone =
    ["allow", "active", "verified", "delivered", "sent", "trialing"].includes(v)
      ? "border-primary/40 text-primary"
      : ["deny", "failed", "suspended", "rejected", "blocked"].includes(v)
        ? "border-destructive/40 text-destructive"
        : ["pending", "queued", "paused", "submitted"].includes(v)
          ? "border-warning/40 text-warning"
          : "border-border text-muted-foreground";
  return (
    <span className={`inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[11px] ${tone}`}>{v}</span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-2 text-left mono-label font-normal">{children}</th>;
}

export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td className={`border-t border-border px-4 py-2.5 text-sm ${mono ? "font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

export function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
