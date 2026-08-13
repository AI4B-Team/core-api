import type { SupabaseClient } from "@supabase/supabase-js";
import { stateFromE164 } from "./nanp";

export type PolicyAction = "send" | "call" | "offer" | "negotiate" | "sign" | "record";
export type ActorType = "user" | "ai" | "automation";

export interface PolicyInput {
  workspaceId: string;
  appId: string;
  action: PolicyAction;
  channel?: string | null;
  identifier?: string | null;
  contactId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
}

export interface RuleResult {
  rule: string;
  result: "pass" | "deny" | "skipped";
  detail?: string | undefined;
}

export interface PolicyDecision {
  decision: "allow" | "allow_with_announcement" | "deny";
  policy_check_id: string;
  denied_by?: string | undefined;
  reason?: string | undefined;
  rules_evaluated: RuleResult[];
}

export interface RecordingDecision extends PolicyDecision {
  consent_type: "one_party" | "all_party" | "unknown";
  requires_announcement: boolean;
  called_state: string | null;
}

interface PackRules {
  quiet_hours: { start: number; end: number };
  daily_cap_per_contact: number;
  block_line_types: string[];
  require_verified_brand: boolean;
  max_autonomy: Record<string, number>;
}

const DEFAULT_RULES: PackRules = {
  quiet_hours: { start: 8, end: 21 },
  daily_cap_per_contact: 3,
  block_line_types: ["landline"],
  require_verified_brand: true,
  max_autonomy: { send: 3, call: 2, offer: 1, negotiate: 1, sign: 1 },
};

/** Most restrictive wins when a workspace stacks multiple packs. */
function mergeRules(packs: Partial<PackRules>[], overrides: Partial<PackRules>): PackRules {
  const merged: PackRules = {
    quiet_hours: { ...DEFAULT_RULES.quiet_hours },
    daily_cap_per_contact: DEFAULT_RULES.daily_cap_per_contact,
    block_line_types: [...DEFAULT_RULES.block_line_types],
    require_verified_brand: DEFAULT_RULES.require_verified_brand,
    max_autonomy: { ...DEFAULT_RULES.max_autonomy },
  };
  for (const p of [...packs, overrides]) {
    if (!p) continue;
    if (p.quiet_hours) {
      merged.quiet_hours.start = Math.max(merged.quiet_hours.start, p.quiet_hours.start);
      merged.quiet_hours.end = Math.min(merged.quiet_hours.end, p.quiet_hours.end);
    }
    if (typeof p.daily_cap_per_contact === "number")
      merged.daily_cap_per_contact = Math.min(merged.daily_cap_per_contact, p.daily_cap_per_contact);
    if (p.block_line_types)
      merged.block_line_types = Array.from(new Set([...merged.block_line_types, ...p.block_line_types]));
    if (typeof p.require_verified_brand === "boolean")
      merged.require_verified_brand = merged.require_verified_brand || p.require_verified_brand;
    if (p.max_autonomy) {
      for (const [k, v] of Object.entries(p.max_autonomy)) {
        merged.max_autonomy[k] = Math.min(merged.max_autonomy[k] ?? 3, v);
      }
    }
  }
  return merged;
}

function localHour(timezone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone })
        .format(new Date())
        .replace("24", "0"),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * The single chokepoint. Every regulated action passes through here and every
 * evaluation — allow or deny — is persisted to policy_checks.
 */
export async function assertPolicy(
  db: SupabaseClient,
  input: PolicyInput,
): Promise<PolicyDecision> {
  const rules: RuleResult[] = [];
  let deniedBy: string | undefined;
  let reason: string | undefined;

  const { data: workspace } = await db
    .from("workspaces")
    .select("id, legal_entity_id, timezone, industry")
    .eq("id", input.workspaceId)
    .maybeSingle();

  if (!workspace) throw new Error("workspace_not_found");
  const legalEntityId = workspace.legal_entity_id as string;

  const { data: wp } = await db
    .from("workspace_policies")
    .select("policy_pack_ids, overrides, autonomy_level")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const packIds: string[] = wp?.policy_pack_ids ?? ["us-sms-default"];
  const { data: packs } = await db.from("policy_packs").select("id, rules").in("id", packIds);
  const merged = mergeRules(
    (packs ?? []).map((p) => p.rules as Partial<PackRules>),
    (wp?.overrides ?? {}) as Partial<PackRules>,
  );

  const deny = (rule: string, detail: string) => {
    rules.push({ rule, result: "deny", detail });
    deniedBy = rule;
    reason = detail;
  };
  const pass = (rule: string, detail?: string) => rules.push({ rule, result: "pass", detail });
  const skip = (rule: string, detail: string) => rules.push({ rule, result: "skipped", detail });

  const messagingAction = input.action === "send" || input.action === "call";

  // 1. Suppression. Multiple rows can match (channel-specific plus 'all'), so
  //    never use maybeSingle here — a multi-row error would silently pass.
  if (input.identifier) {
    const channels = [input.channel ?? "sms", "all"];
    const { data: hits } = await db
      .from("suppressions")
      .select("id, reason, channel")
      .eq("legal_entity_id", legalEntityId)
      .eq("identifier", input.identifier)
      .in("channel", channels)
      .limit(1);
    const hit = (hits ?? [])[0];
    if (hit) deny("suppression", `Suppressed for this entity (${hit.reason})`);
    else pass("suppression");
  } else {
    skip("suppression", "no identifier supplied");
  }

  // 2 & 3. Federal DNC / litigator scrub — external providers not configured.
  if (!deniedBy) {
    skip("federal_dnc", "no SAN configured for this entity");
    skip("litigator_list", "litigator scrub provider not configured");
  }

  // 4. Line type. The same number can belong to several contacts in one entity;
  //    any blocked line type on that number denies.
  if (!deniedBy && messagingAction && input.identifier) {
    const { data: phones } = await db
      .from("contact_phones")
      .select("line_type")
      .eq("legal_entity_id", legalEntityId)
      .eq("e164", input.identifier)
      .limit(20);
    const lineTypes = (phones ?? [])
      .map((p) => p.line_type as string | null)
      .filter((t): t is string => Boolean(t));
    const blocked = lineTypes.find((t) => merged.block_line_types.includes(t));
    if (blocked) deny("line_type", `${blocked} numbers are blocked for this workspace`);
    else pass("line_type", lineTypes[0] ?? "unknown");
  }


  // 5. Quiet hours in the contact's local time
  if (!deniedBy && messagingAction) {
    let tz = workspace.timezone as string;
    if (input.contactId) {
      const { data: contact } = await db
        .from("contacts")
        .select("timezone")
        .eq("id", input.contactId)
        .maybeSingle();
      if (contact?.timezone) tz = contact.timezone;
    }
    const hour = localHour(tz);
    if (hour < merged.quiet_hours.start || hour >= merged.quiet_hours.end)
      deny(
        "quiet_hours",
        `Local time ${hour}:00 in ${tz} is outside ${merged.quiet_hours.start}:00-${merged.quiet_hours.end}:00`,
      );
    else pass("quiet_hours", `${hour}:00 ${tz}`);
  }

  // 6. Daily per-contact frequency cap
  if (!deniedBy && messagingAction && input.contactId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("direction", "outbound")
      .gte("created_at", since)
      .eq("to_identifier", input.identifier ?? "");
    if ((count ?? 0) >= merged.daily_cap_per_contact)
      deny("frequency_cap", `${count} outbound in 24h, cap is ${merged.daily_cap_per_contact}`);
    else pass("frequency_cap", `${count ?? 0}/${merged.daily_cap_per_contact}`);
  }

  // 7. Brand and campaign status
  if (!deniedBy && messagingAction && merged.require_verified_brand) {
    const { data: brand } = await db
      .from("brands")
      .select("id, status")
      .eq("legal_entity_id", legalEntityId)
      .maybeSingle();
    if (!brand) deny("brand_status", "no 10DLC brand registered for this legal entity");
    else if (brand.status !== "verified") deny("brand_status", `brand status is ${brand.status}`);
    else {
      const { data: campaign } = await db
        .from("campaigns_10dlc")
        .select("id, status")
        .eq("brand_id", brand.id)
        .eq("app_id", input.appId)
        .maybeSingle();
      if (!campaign) deny("campaign_status", `no 10DLC campaign for app ${input.appId}`);
      else if (campaign.status !== "active" && campaign.status !== "verified")
        deny("campaign_status", `campaign status is ${campaign.status}`);
      else pass("brand_status", "verified");
    }
  }

  // 8. Autonomy gate
  if (!deniedBy) {
    if (input.actorType === "ai") {
      const level = wp?.autonomy_level ?? 0;
      const max = merged.max_autonomy[input.action] ?? 0;
      if (level > max)
        deny(
          "autonomy_gate",
          `workspace autonomy ${level} exceeds max ${max} for '${input.action}' under this policy pack`,
        );
      else if (max === 0) deny("autonomy_gate", `AI '${input.action}' is not permitted by policy pack`);
      else pass("autonomy_gate", `level ${level} <= ${max}`);
    } else {
      pass("autonomy_gate", `actor_type=${input.actorType}`);
    }
  }

  const decision = deniedBy ? "deny" : "allow";

  const { data: check, error } = await db
    .from("policy_checks")
    .insert({
      workspace_id: input.workspaceId,
      legal_entity_id: legalEntityId,
      app_id: input.appId,
      action: input.action,
      channel: input.channel ?? null,
      identifier: input.identifier ?? null,
      contact_id: input.contactId ?? null,
      decision,
      rules_evaluated: rules,
      denied_by: deniedBy ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`policy_check_persist_failed: ${error.message}`);

  return {
    decision,
    policy_check_id: check.id as string,
    ...(deniedBy ? { denied_by: deniedBy, reason } : {}),
    rules_evaluated: rules,
  };
}

/**
 * Recording consent chokepoint.
 *
 * The jurisdiction that matters is the CALLED party's, not the caller's. When
 * that jurisdiction is all-party, unknown, or not yet human-verified, the
 * decision is `allow_with_announcement` — never a plain allow. Fail toward
 * announcing. Supervisor monitor/whisper/barge legs are subject to this too.
 */
export async function assertCanRecord(
  db: SupabaseClient,
  input: Omit<PolicyInput, "action" | "channel"> & { calledE164: string },
): Promise<RecordingDecision> {
  const rules: RuleResult[] = [];
  let deniedBy: string | undefined;
  let reason: string | undefined;

  const { data: workspace } = await db
    .from("workspaces")
    .select("id, legal_entity_id")
    .eq("id", input.workspaceId)
    .maybeSingle();
  if (!workspace) throw new Error("workspace_not_found");
  const legalEntityId = workspace.legal_entity_id as string;

  // Suppression still applies to the recorded party.
  const { data: hit } = await db
    .from("suppressions")
    .select("id, reason")
    .eq("legal_entity_id", legalEntityId)
    .eq("identifier", input.calledE164)
    .in("channel", ["voice", "all"])
    .maybeSingle();
  if (hit) {
    rules.push({ rule: "suppression", result: "deny", detail: `Suppressed (${hit.reason})` });
    deniedBy = "suppression";
    reason = `Suppressed for this entity (${hit.reason})`;
  } else {
    rules.push({ rule: "suppression", result: "pass" });
  }

  const state = stateFromE164(input.calledE164);
  let consentType: "one_party" | "all_party" | "unknown" = "unknown";
  let requiresAnnouncement = true;

  if (!deniedBy) {
    if (!state) {
      rules.push({
        rule: "recording_consent",
        result: "pass",
        detail: "called party jurisdiction undeterminable — announcement required",
      });
    } else {
      const { data: rule } = await db
        .from("recording_consent_rules")
        .select("state, consent_type, statute_citation, verified_at")
        .eq("state", state)
        .maybeSingle();
      if (!rule) {
        rules.push({
          rule: "recording_consent",
          result: "pass",
          detail: `no consent rule on file for ${state} — announcement required`,
        });
      } else {
        consentType = rule.consent_type as "one_party" | "all_party";
        const verified = Boolean(rule.verified_at);
        requiresAnnouncement = consentType === "all_party" || !verified;
        rules.push({
          rule: "recording_consent",
          result: "pass",
          detail: `${state} ${consentType}${verified ? " (verified)" : " (unverified)"}${
            rule.statute_citation ? ` ${rule.statute_citation}` : ""
          }`,
        });
      }
    }
  }

  const decision: RecordingDecision["decision"] = deniedBy
    ? "deny"
    : requiresAnnouncement
      ? "allow_with_announcement"
      : "allow";

  const { data: check, error } = await db
    .from("policy_checks")
    .insert({
      workspace_id: input.workspaceId,
      legal_entity_id: legalEntityId,
      app_id: input.appId,
      action: "record",
      channel: "voice",
      identifier: input.calledE164,
      contact_id: input.contactId ?? null,
      decision,
      rules_evaluated: rules,
      denied_by: deniedBy ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`policy_check_persist_failed: ${error.message}`);

  return {
    decision,
    policy_check_id: check.id as string,
    ...(deniedBy ? { denied_by: deniedBy, reason } : {}),
    rules_evaluated: rules,
    consent_type: consentType,
    requires_announcement: deniedBy ? false : requiresAnnouncement,
    called_state: state,
  };
}
