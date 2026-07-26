/**
 * health-os/multimodal/voice.ts — PURE speech-to-text normalization (P5).
 *
 * Voice is an INPUT modality only: STT runs in front of the EXISTING chat / log-extract
 * pipeline — the deterministic router and provider seam are untouched. This file cleans a
 * raw transcript and makes the one routing call the UI needs: does this read like a log
 * ("had eggs and a 5k run") or a question to Gozlin? No native imports.
 */
import type { VoiceCapture } from "./types";

/** Collapse whitespace, trim, and sentence-case the first letter. */
export function cleanTranscript(raw: string): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t[0].toUpperCase() + t.slice(1);
}

// Verbs/nouns that strongly imply the user is RECORDING something they did.
const LOG_CUES =
  /\b(ate|eaten|had|drank|drink|logged|log|ran|run|walked|walk|did|completed|finished|trained|workout|workouts|reps|sets|km|miles|calories|protein|water|breakfast|lunch|dinner|snack|weigh|weighed)\b/i;
// A sentence that OPENS with one of these reads as a question to the coach, even if it
// also mentions a food/metric ("how many calories in rice").
const QUESTION_LEAD = /^(what|why|how|should|can|could|when|where|who|is|are|do|does|recommend|suggest)\b/i;

/** Heuristic: does the transcript read like a log vs a question to the coach? */
export function looksLikeLog(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.endsWith("?")) return false;
  if (QUESTION_LEAD.test(t)) return false;
  return LOG_CUES.test(t);
}

/** Normalize a raw STT result into a routed VoiceCapture. */
export function toVoiceCapture(raw: string): VoiceCapture {
  const text = cleanTranscript(raw);
  return { text, looksLikeLog: looksLikeLog(text) };
}
