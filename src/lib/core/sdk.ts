/**
 * Minimal Core client SDK.
 *
 * Apps talk to Core over the public /v1 surface with either a per-app service
 * credential (`core_sk_...`) or a Core-issued user JWT.
 *
 *   const core = createCoreClient({ baseUrl, token })
 *   await core.policy.assert({ ... })
 *   await core.policy.assertBulk({ ... })
 */

export type PolicyAction = "send" | "call" | "offer" | "negotiate" | "sign";
export type ActorType = "user" | "ai" | "automation";

export interface CoreClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface AssertInput {
  workspace_id: string;
  action: PolicyAction;
  channel?: string;
  identifier?: string;
  contact_id?: string;
  actor_type: ActorType;
  actor_id?: string;
}

export interface AssertResult {
  decision: "allow" | "allow_with_announcement" | "deny";
  policy_check_id: string;
  denied_by?: string;
  reason?: string;
  rules_evaluated: { rule: string; result: string; detail?: string }[];
}

export interface AssertBulkInput {
  workspace_id: string;
  action: PolicyAction;
  channel?: string;
  /** Max 1000 per request. */
  identifiers: string[];
  actor_type: ActorType;
  actor_id?: string;
}

export interface AssertBulkResult {
  /** Always true. Bulk results are point-in-time and never authorize a send. */
  advisory_only: true;
  note: string;
  evaluated_at: string;
  results: {
    identifier: string;
    decision: "allow" | "deny" | "error";
    denied_by: string | null;
    reason: string | null;
    policy_check_id: string | null;
    error?: string;
  }[];
  summary: {
    total: number;
    allowed: number;
    denied: number;
    errors: number;
    denied_by_rule: Record<string, number>;
  };
}

export const MAX_BULK_IDENTIFIERS = 1000;

export class CoreApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`core_api_error_${status}`);
  }
}

export function createCoreClient(options: CoreClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    // A policy deny comes back as 403 with a decision body; surface it as data.
    if (!res.ok && !(res.status === 403 && payload && "decision" in payload)) {
      throw new CoreApiError(res.status, payload);
    }
    return payload as T;
  }

  return {
    policy: {
      assert: (input: AssertInput) => post<AssertResult>("/api/public/v1/policy/assert", input),

      /**
       * Batched, identical-rule evaluation for building and filtering queues.
       * Advisory only — re-assert at the moment of contact.
       */
      assertBulk: async (input: AssertBulkInput) => {
        if (input.identifiers.length > MAX_BULK_IDENTIFIERS) {
          throw new Error(`identifiers exceeds max of ${MAX_BULK_IDENTIFIERS}`);
        }
        return post<AssertBulkResult>("/api/public/v1/policy/assert-bulk", input);
      },
    },
  };
}

export type CoreClient = ReturnType<typeof createCoreClient>;
