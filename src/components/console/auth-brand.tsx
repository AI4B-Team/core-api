import type { CoreBranding } from "@/lib/core/branding.functions";

/** Neutral Real Elite lockup, overridable by per-account white-label settings. */
export function BrandMark({
  branding,
  subtitle,
}: {
  branding?: CoreBranding | null | undefined;
  subtitle?: string;
}) {
  const name = branding?.brandName ?? "Real Elite";
  return (
    <div className="flex items-center gap-3">
      {branding?.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={`${name} logo`}
          className="h-7 w-auto max-w-[140px] object-contain"
        />
      ) : (
        <span
          className="size-2.5 rounded-full bg-primary"
          style={branding?.accentColor ? { backgroundColor: branding.accentColor } : undefined}
        />
      )}
      <span className="font-mono text-sm font-medium">{name.toLowerCase()}</span>
      {subtitle && <span className="mono-label">{subtitle}</span>}
    </div>
  );
}

export function BrandFooter({ branding }: { branding?: CoreBranding | null }) {
  return (
    <p className="mono-label mt-10">
      secured by {(branding?.brandName ?? "Real Elite").toLowerCase()} core
      {branding?.supportEmail ? ` · ${branding.supportEmail}` : ""}
    </p>
  );
}
