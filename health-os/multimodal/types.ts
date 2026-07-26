/**
 * health-os/multimodal/types.ts — shared vocabulary for photo + voice logging (P5).
 *
 * A `LogDraft` is a PROPOSED log entry (never a silent commit). The pipeline is:
 *   capture (photo/voice) → analyze → LogDraft[] → user confirms/edits → commit.
 * The confirm-before-commit + idempotent-commit discipline mirrors the calendar Signals
 * (proposals) and the M4 conversation-logging contract this plugs into.
 *
 * NOTE: the COMMIT step (drafts → live nutrition state + Timeline) is owned by M4
 * conversation-first logging (docs/architecture/06, /12). This module owns everything UP
 * TO the confirmed draft — capture, analysis, normalization — so it's ready the moment M4
 * lands. See docs/companion/00-proactive-companion-blueprint.md §4 (P5).
 */
import type { MealSlot } from "../timeline/catalog";

export type LogDraftKind = "meal" | "water" | "workout";
export type LogDraftSource = "photo" | "voice" | "text";

export interface LogDraft {
  /** Deterministic per capture → idempotent commit (a re-confirm never double-logs). */
  id: string;
  kind: LogDraftKind;
  source: LogDraftSource;
  /** 0–1; low-confidence drafts render unchecked so nothing is logged by accident. */
  confidence: number;
  /** Display name ("Grilled chicken & rice"). */
  name: string;
  slot?: MealSlot;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** Water drafts only — millilitres. */
  ml?: number;
}

/** One food the photo analyzer detected. */
export interface AnalyzedFood {
  name: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** 0–1 detector confidence. */
  confidence?: number;
}

/** The structured result of analyzing a meal photo (server `/v1/log/photo`). */
export interface MealPhotoAnalysis {
  foods: AnalyzedFood[];
  slot?: MealSlot;
  note?: string;
}

/** A normalized voice capture (post speech-to-text). */
export interface VoiceCapture {
  /** Cleaned transcript text. */
  text: string;
  /** Whether it reads like a log ("had eggs and a 5k run") vs a chat question. */
  looksLikeLog: boolean;
}
