/**
 * Carrier provider adapter.
 *
 * There are no provider credentials in this build. The stub NEVER fabricates a
 * successful send: with no provider configured every send fails closed, and the
 * stub path itself only runs when CORE_ALLOW_STUB_PROVIDER is explicitly "true".
 */

export interface SendRequest {
  from: string;
  to: string;
  body: string;
  channel: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string; status: "queued" }
  | { ok: false; error: "provider_not_configured"; errorCode: "no_provider" };

export function providerConfigured(): boolean {
  return Boolean(process.env["TWILIO_ACCOUNT_SID"] || process.env["TELNYX_API_KEY"]);
}

export function stubProviderAllowed(): boolean {
  return process.env["CORE_ALLOW_STUB_PROVIDER"] === "true";
}

export async function sendViaProvider(_req: SendRequest): Promise<SendResult> {
  if (!providerConfigured()) {
    return { ok: false, error: "provider_not_configured", errorCode: "no_provider" };
  }
  // Real Twilio/Telnyx transport is wired here once credentials exist.
  return { ok: false, error: "provider_not_configured", errorCode: "no_provider" };
}
