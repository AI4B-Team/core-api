/**
 * Canonical Core event types. Apps declare what they emit and consume against
 * this list; the signed event bus rejects anything not named here.
 */
export const CORE_EVENT_TYPES = [
  // identity + entitlement
  "workspace.created",
  "entitlement.changed",
  // contacts
  "contact.created",
  "contact.updated",
  "contact.opted_out",
  // messaging
  "message.sent",
  "message.received",
  "message.failed",
  // policy + credits
  "policy.denied",
  "credits.consumed",
  // voice + assistant
  "call.started",
  "call.ended",
  "call.recorded",
  "transcript.ready",
  "extraction.ready",
  "assist.suggested",
] as const;

export type CoreEventType = (typeof CORE_EVENT_TYPES)[number];

export function isCoreEventType(value: string): value is CoreEventType {
  return (CORE_EVENT_TYPES as readonly string[]).includes(value);
}
