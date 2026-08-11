import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

const consumeSchema = z.object({
  workspace_id: z.string().uuid(),
  meter_id: z.string().min(1).max(60),
  quantity: z.number().positive().max(1_000_000),
  idempotency_key: z.string().min(8).max(200),
  reference: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/v1/credits/consume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = consumeSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        const { data, error } = await db.rpc("consume_credits", {
          _workspace_id: input.workspace_id,
          _meter_id: input.meter_id,
          _quantity: -Math.abs(input.quantity),
          _app_id: caller.appId,
          _idempotency_key: input.idempotency_key,
          _reference: input.reference ?? {},
        });
        if (error) return apiError("consume_failed", 400, { detail: error.message });
        return json({ entry: data });
      },
    },
  },
});
