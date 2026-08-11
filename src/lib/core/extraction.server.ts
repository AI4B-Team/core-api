import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Channel-agnostic post-conversation extraction. A call transcript and an SMS
 * thread both reduce to an ordered list of provenance-tagged utterances, so one
 * pass serves both. Fields are PROPOSED — nothing here is auto-committed.
 */
export interface FieldSpec {
  key: string;
  type: "string" | "number" | "boolean" | "date";
  description?: string | undefined;
}

interface Utterance {
  ref: string;
  speaker: string;
  text: string;
}

export interface ExtractionInput {
  workspaceId: string;
  sourceType: "call" | "sms_thread";
  sourceId: string;
  schemaId?: string;
  fields?: FieldSpec[];
}

async function loadUtterances(
  db: SupabaseClient,
  input: ExtractionInput,
): Promise<Utterance[]> {
  if (input.sourceType === "call") {
    const { data: session } = await db
      .from("call_sessions")
      .select("id, workspace_id")
      .eq("id", input.sourceId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (!session) throw new Error("source_not_found");

    const { data: transcript } = await db
      .from("call_transcripts")
      .select("id, segments, full_text")
      .eq("call_session_id", input.sourceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!transcript) throw new Error("no_transcript");

    const segments = (transcript.segments ?? []) as {
      speaker?: string;
      text?: string;
      start_ms?: number;
    }[];
    if (segments.length) {
      return segments
        .filter((s) => s.text)
        .map((s, i) => ({
          ref: `transcript:${transcript.id}:segment:${i}`,
          speaker: s.speaker ?? "unknown",
          text: s.text as string,
        }));
    }
    return transcript.full_text
      ? [{ ref: `transcript:${transcript.id}`, speaker: "unknown", text: transcript.full_text }]
      : [];
  }

  const { data: messages } = await db
    .from("messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", input.sourceId)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (!messages?.length) throw new Error("source_not_found");
  return messages
    .filter((m) => m.body)
    .map((m) => ({
      ref: `message:${m.id}`,
      speaker: m.direction === "outbound" ? "agent" : "contact",
      text: m.body as string,
    }));
}

interface ModelOutput {
  summary: string;
  proposed_disposition: string;
  fields: Record<string, { value: unknown; confidence: number; provenance: string | null }>;
}

async function runModel(utterances: Utterance[], fields: FieldSpec[]): Promise<ModelOutput> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("ai_not_configured");

  const transcript = utterances.map((u) => `[${u.ref}] ${u.speaker}: ${u.text}`).join("\n");
  const schemaHint = fields.length
    ? fields.map((f) => `- ${f.key} (${f.type})${f.description ? `: ${f.description}` : ""}`).join("\n")
    : "- (no field schema supplied; return an empty fields object)";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        {
          role: "system",
          content:
            "You extract structured data from sales conversations. Use ONLY the supplied transcript. " +
            "Every field value must cite the [ref] tag of the line it came from as its provenance. " +
            "If a field is not stated in the transcript, return null with confidence 0 and null provenance. " +
            "Never infer from outside knowledge. Respond with JSON only.",
        },
        {
          role: "user",
          content:
            `Fields to extract:\n${schemaHint}\n\nTranscript:\n${transcript}\n\n` +
            `Return JSON: {"summary": string, "proposed_disposition": string, "fields": {"<key>": {"value": any, "confidence": number 0-1, "provenance": "<ref>"|null}}}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`extraction_model_failed_${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = body.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<ModelOutput>;
  return {
    summary: parsed.summary ?? "",
    proposed_disposition: parsed.proposed_disposition ?? "unknown",
    fields: parsed.fields ?? {},
  };
}

export async function extractFromSource(db: SupabaseClient, input: ExtractionInput) {
  const utterances = await loadUtterances(db, input);
  if (!utterances.length) throw new Error("no_transcript");

  const out = await runModel(utterances, input.fields ?? []);
  const validRefs = new Set(utterances.map((u) => u.ref));

  const fields: Record<string, { value: unknown; provenance: string | null }> = {};
  const confidence: Record<string, number> = {};
  for (const [k, v] of Object.entries(out.fields)) {
    const provenance = v?.provenance && validRefs.has(v.provenance) ? v.provenance : null;
    fields[k] = { value: provenance ? (v?.value ?? null) : null, provenance };
    confidence[k] = provenance ? Number(v?.confidence ?? 0) : 0;
  }

  const { data, error } = await db
    .from("extraction_results")
    .insert({
      workspace_id: input.workspaceId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      schema_id: input.schemaId ?? null,
      fields,
      confidence,
      summary: out.summary,
      proposed_disposition: out.proposed_disposition,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return { extraction: data, proposed: true };
}
