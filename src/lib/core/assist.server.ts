/**
 * Live assist matcher.
 *
 * Latency is the product. Playbook matching is pure string work (sub-millisecond)
 * and handles the common cases; knowledge retrieval is the fallback and only runs
 * when nothing matched AND the utterance looks like a question. Nothing here ever
 * routes an utterance through an LLM.
 */
export const ASSIST_LATENCY_BUDGET_MS = 1500;
export const ASSIST_DROP_AFTER_MS = 3000;

export type SuggestionType =
  | "objection"
  | "knowledge_answer"
  | "script_prompt"
  | "compliance_reminder";

export interface PlaybookTrigger {
  match: string;
  suggestion_type: SuggestionType;
  response: string;
  priority?: number;
}

export interface PlaybookHit {
  suggestion_type: SuggestionType;
  suggestion: string;
  matched: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s?]/g, " ").replace(/\s+/g, " ").trim();
}

/** Highest-priority literal/regex trigger wins. No model call. */
export function matchPlaybooks(utterance: string, triggers: PlaybookTrigger[]): PlaybookHit | null {
  const text = normalize(utterance);
  if (!text) return null;
  let best: { hit: PlaybookHit; priority: number } | null = null;
  for (const t of triggers) {
    if (!t?.match || !t.response) continue;
    const needle = normalize(t.match);
    let matched = needle.length > 0 && text.includes(needle);
    if (!matched && /[\\^$*+?()[\]{}|]/.test(t.match)) {
      try {
        matched = new RegExp(t.match, "i").test(utterance);
      } catch {
        matched = false;
      }
    }
    if (!matched) continue;
    const priority = t.priority ?? 0;
    if (!best || priority > best.priority) {
      best = {
        priority,
        hit: { suggestion_type: t.suggestion_type, suggestion: t.response, matched: t.match },
      };
    }
  }
  return best?.hit ?? null;
}

const QUESTION_LEADS = [
  "what", "when", "where", "who", "why", "how", "can you", "could you", "do you", "does",
  "is there", "are there", "will you", "would", "should", "how much", "how long",
];

export function looksLikeQuestion(utterance: string): boolean {
  const text = normalize(utterance);
  if (!text) return false;
  if (text.endsWith("?")) return true;
  return QUESTION_LEADS.some((lead) => text.startsWith(lead) || text.includes(` ${lead} `));
}

/** A suggestion older than the drop threshold is discarded, never queued. */
export function withinBudget(startedAt: number): boolean {
  return Date.now() - startedAt < ASSIST_DROP_AFTER_MS;
}
