import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { extractFromSource } from "@/lib/core/extraction.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  source_type: z.enum(["call", "sms_thread"]),
  source_id: z.string().uuid(),
  schema_id: z.string().max(120).optional(),
  fields: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        type: z.enum(["string", "number", "boolean", "date"]).default("string"),
        description: z.string().max(400).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const Route = createFileRoute("/api/public/v1/extraction/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        try {
          const result = await extractFromSource(db, {
            workspaceId: input.workspace_id,
            sourceType: input.source_type,
            sourceId: input.source_id,
            ...(input.schema_id ? { schemaId: input.schema_id } : {}),
            ...(input.fields ? { fields: input.fields } : {}),
          });
          return json(result);
        } catch (e) {
          const message = (e as Error).message;
          if (message === "source_not_found") return apiError("source_not_found", 404);
          if (message === "no_transcript") return apiError("no_transcript", 409);
          return apiError("extraction_failed", 502, { detail: message });
        }
      },
    },
  },
});
