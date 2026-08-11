import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";

const triggerSchema = z.object({
  match: z.string().min(1).max(300),
  suggestion_type: z.enum(["objection", "knowledge_answer", "script_prompt", "compliance_reminder"]),
  response: z.string().min(1).max(2000),
  priority: z.number().int().min(0).max(1000).optional(),
});

const schema = z.object({
  workspace_id: z.string().uuid(),
  industry: z.string().max(80).optional(),
  triggers: z.array(triggerSchema).min(1).max(500),
  is_active: z.boolean().default(true),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/v1/assist/playbooks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);
        const workspaceId = new URL(request.url).searchParams.get("workspace_id") ?? "";
        if (!z.string().uuid().safeParse(workspaceId).success)
          return apiError("workspace_id_required", 400);
        if (!(await assertWorkspaceScope(db, caller, workspaceId))) return apiError("forbidden", 403);

        const { data } = await db
          .from("assist_playbooks")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        return json({ playbooks: data ?? [] });
      },

      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        const row = {
          workspace_id: input.workspace_id,
          industry: input.industry ?? null,
          triggers: input.triggers,
          is_active: input.is_active,
          updated_at: new Date().toISOString(),
        };

        const query = input.id
          ? db.from("assist_playbooks").update(row).eq("id", input.id).eq("workspace_id", input.workspace_id)
          : db.from("assist_playbooks").insert(row);

        const { data, error } = await query.select("id, is_active").single();
        if (error) return apiError("playbook_save_failed", 400, { detail: error.message });
        return json({ playbook: data });
      },
    },
  },
});
