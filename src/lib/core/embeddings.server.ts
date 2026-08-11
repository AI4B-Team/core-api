/**
 * Embeddings for the knowledge base, via the Lovable AI gateway.
 * 1536-dimension vectors, matching knowledge_chunks.embedding.
 */
const MODEL = "openai/text-embedding-3-small";

export async function embed(inputs: string[]): Promise<number[][]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("ai_not_configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    throw new Error(`embedding_failed_${res.status}: ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Simple paragraph-aware chunker. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    if (end < clean.length) {
      const brk = clean.lastIndexOf("\n", end);
      if (brk > i + size * 0.5) end = brk;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks.filter(Boolean);
}
