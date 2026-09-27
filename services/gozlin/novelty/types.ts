/**
 * Shared shapes for "trying something new" (docs/gozlin/11-trying-something-new.md).
 * Types only — kept apart so the engines, the store and the agent can all
 * import them without importing each other.
 */

import type { Difficulty, ExerciseCategory } from "../../../models/exercise";
import type { ClinicalRiskKind } from "../agent/clinical";
import type { ExerciseSubject } from "./subjects";

/** Only exercises in Phase 1. Food is deliberately absent — see the doc, §9. */
export type ExperienceKind = "exercise";

/** Where a record came from. */
export type ExperienceSource = "asked-chip" | "asked-chat" | "volunteered";

/** 0 nothing much · 1 a bit · 2 quite · 3 very. */
export type Soreness = 0 | 1 | 2 | 3;

export type Enjoyed = "yes" | "mixed" | "no";

/**
 * One thing they tried, and what they said about it. The memory itself.
 *
 * EFFECT answers (soreness, feelings) feed coaching — "last time these left you
 * very sore for two days". ENJOYMENT answers feed planning later (Phase 3), so
 * they are stored now and read by nothing yet.
 */
export interface ExperienceRecord {
  id: string;
  kind: ExperienceKind;
  variantKey: string;
  familyKey: string;
  /** The name as they saw it in the player. */
  label: string;
  /** The session date, or null for something they mentioned that isn't on their log. */
  triedOn: string | null;
  /** ISO — when they told us. */
  answeredAt: string;
  source: ExperienceSource;
  /** Their words, VERBATIM, clipped at 140 characters. Never a paraphrase. */
  quote: string | null;
  soreness: Soreness | null;
  enjoyed: Enjoyed | null;
  /** Words from the mood log's vocabulary (services/gozlin/mind.ts). */
  feelings: string[];
  /** Their words tripped the clinical screen — recalled only with a referral rule. */
  clinical?: ClinicalRiskKind;
  /** ISO — last time a reply actually used this memory. Starts the recall rest. */
  lastRecalledAt?: string;
  /**
   * ISO — the last change to this record. Sync resolves a record present on
   * two phones by it (services/sync/mergeStrategies.ts), which is what lets a
   * Forget on one phone beat the copy still sitting on the other.
   */
  updatedAt: string;
  /**
   * A TOMBSTONE. Forgetting a record scrubs every word of it and keeps only
   * this flag, the id and the time — because notes sync by merging, and a
   * record simply deleted here would be merged straight back from another
   * phone that still had it. Readers never see a forgotten record.
   */
  forgotten?: boolean;
}

/** What the detector found, before any gate decides whether to ask. */
export interface NoveltyCandidate {
  kind: ExperienceKind;
  variantKey: string;
  familyKey: string;
  label: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  /** A whole new family, or a harder variant than any done in a known one. */
  novelty: "family" | "harder";
  triedRunId: string;
  /** ISO — the session's completedAt. */
  triedAt: string;
  /** YYYY-MM-DD — the session's local date. */
  triedOn: string;
  score: number;
  /**
   * Exactly what the log can prove, frozen the moment it was first seen:
   * "N sessions logged before it, going back to <since>". Never a duration —
   * the ledger proves a count and a start date, not "8 weeks".
   */
  evidence: { sessionsBefore: number; since: string };
}

export type CuriosityStatus = "open" | "answered" | "dismissed" | "expired" | "ignored";

/** One question that was opened, and what became of it. */
export interface CuriosityEntry {
  id: string;
  kind: ExperienceKind;
  variantKey: string;
  familyKey: string;
  label: string;
  category: ExerciseCategory;
  /** A whole new family, or the hardest version of a known one — worded differently. */
  novelty: "family" | "harder";
  triedRunId: string;
  triedAt: string;
  triedOn: string;
  evidence: { sessionsBefore: number; since: string };
  /** ISO — when this question was first shown. */
  openedAt: string;
  opensAt: string;
  closesAt: string;
  status: CuriosityStatus;
  /** ISO — when it stopped being open, if it did before its window closed. */
  closedAt?: string;
  /** Agent turns that carried the question line (capped — see CHAT_LIMITS). */
  turnsCarried: number;
  /** Agent turns that carried the capture line after it was asked. */
  captureTurns: number;
  /** ISO — when a reply actually asked it. */
  askedInChatAt?: string;
  /** ISO — the last change; how sync picks between two phones' copies. */
  updatedAt: string;
}

/**
 * Everything the coach needs to know about this feature for one turn, built by
 * the caller (components/gozlin/useCuriosity) and carried on the chat context.
 * Optional there, and `enabled: false` whenever the Trust switch is off or the
 * account is not Pro — in which case nothing downstream says a word.
 */
export interface ExperienceBrief {
  enabled: boolean;
  /** The open question, if one is live. */
  due: CuriosityEntry | null;
  /** What they told us, newest first, tombstones excluded. */
  records: ExperienceRecord[];
  /** Today's planned session, as subjects. */
  planned: ExerciseSubject[];
  /** What they did today, as subjects. */
  logged: ExerciseSubject[];
}
