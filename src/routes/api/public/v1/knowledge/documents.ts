import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { chunkText, embed } from "@/lib/core/embeddings.server";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  source_type: z.enum(["upload", "url", "text"]),
  content: z.string().max(500_000).optional(),
  file_path: z.string().max(1000).optional(),
  mime_type: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/v1/knowledge/documents")({
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
          .from("knowledge_documents")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(200);
        return json({ documents: data ?? [] });
      },

      POST: async ({ request }) => {
        const db = await getAdmin();
        const caller = await authenticateCaller(request, db);
        if (!caller) return apiError("unauthorized", 401);

        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return apiError("invalid_request", 400, { issues: parsed.error.issues });
        const input = parsed.data;

        const scope = await assertWorkspaceScope(db, caller, input.workspace_id);
        if (!scope) return apiError("forbidden", 403);

        const { data: doc, error } = await db
          .from("knowledge_documents")
          .insert({
            workspace_id: input.workspace_id,
            title: input.title,
            source_type: input.source_type,
            file_path: input.file_path ?? null,
            mime_type: input.mime_type ?? null,
            status: input.content ? "processing" : "pending",
            created_by: caller.userId ?? null,
          })
          .select("id, status")
          .single();
        if (error || !doc) return apiError("document_create_failed", 400, { detail: error?.message });

        if (!input.content) {
          return json({ document_id: doc.id, status: doc.status, chunks: 0 });
        }

        const chunks = chunkText(input.content);
        try {
          const vectors = await embed(chunks);
          const rows = chunks.map((content, i) => ({
            document_id: doc.id,
            workspace_id: input.workspace_id,
            chunk_index: i,
            content,
            embedding: JSON.stringify(vectors[i]),
          }));
          const { error: chunkError } = await db.from("knowledge_chunks").insert(rows);
          if (chunkError) throw new Error(chunkError.message);

          await db.rpc("consume_credits", {
            _workspace_id: input.workspace_id,
            _meter_id: "knowledge_embedding",
            _quantity: -Math.abs(chunks.length),
            _app_id: caller.appId,
            _idempotency_key: `kb:${doc.id}`,
            _reference: { document_id: doc.id, chunks: chunks.length },
          });

          await db.from("knowledge_documents").update({ status: "ready" }).eq("id", doc.id);
          return json({ document_id: doc.id, status: "ready", chunks: chunks.length });
        } catch (e) {
          await db.from("knowledge_documents").update({ status: "failed" }).eq("id", doc.id);
          return apiError("ingest_failed", 502, {
            document_id: doc.id,
            detail: (e as Error).message,
          });
        }
      },
    },
  },
});
