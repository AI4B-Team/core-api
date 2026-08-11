import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, assertWorkspaceScope, authenticateCaller, getAdmin, json } from "@/lib/core/api.server";
import { embed } from "@/lib/core/embeddings.server";

const schema = z.object({
  workspace_id: z.string().uuid(),
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(8),
});

export const Route = createFileRoute("/api/public/v1/knowledge/search")({
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

        let vector: number[];
        try {
          [vector] = (await embed([input.query])) as [number[]];
        } catch (e) {
          return apiError("embedding_failed", 502, { detail: (e as Error).message });
        }

        const { data, error } = await db.rpc("match_knowledge_chunks", {
          _workspace_id: input.workspace_id,
          _embedding: JSON.stringify(vector),
          _limit: input.limit,
        });
        if (error) return apiError("search_failed", 400, { detail: error.message });

        const rows = (data ?? []) as {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          similarity: number;
        }[];

        // An answer with no supporting chunk is not answered from model knowledge.
        if (!rows.length) {
          return json({ results: [], answer: null, message: "not found in your documents" });
        }

        const docIds = Array.from(new Set(rows.map((r) => r.document_id)));
        const { data: docs } = await db
          .from("knowledge_documents")
          .select("id, title")
          .in("id", docIds);
        const titles = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));

        return json({
          results: rows.map((r) => ({
            chunk_id: r.id,
            document_id: r.document_id,
            document_title: titles.get(r.document_id) ?? null,
            chunk_index: r.chunk_index,
            content: r.content,
            similarity: r.similarity,
          })),
        });
      },
    },
  },
});
