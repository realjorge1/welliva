/**
 * NOVELTY DETECTOR — "is this the first time on their log?", answered only
 * where the log can actually say.
 *
 * ── WHY A LEDGER AND NOT JUST THE HISTORY ───────────────────────────────────
 * Session history keeps the newest 50 sessions (SessionService.saveSummary).
 * At five a week that is ten weeks; anything older is gone. Reading "not in
 * the history" as "never done" would call a move someone did in June "new" in
 * September — the cosmetic claim this product refuses to make.
 *
 * The seen-ledger is the fix: an index of first sightings, fed from every
 * saved session, that never drops a subject. It also knows how far back its
 * own proof goes (`observedSince`), so every claim is stated as exactly what
 * it can prove — "23 sessions logged before it, going back to 14 Jul" — and
 * never as a duration it cannot.
 *
 * ── WHY MISSING ISN'T NEW ───────────────────────────────────────────────────
 * Silence in a log only means something from someone who logs. In the first
 * weeks every exercise is new; for someone who trains once a fortnight, a gap
 * is just a gap. So novelty is only CLAIMED past a coverage floor, measured at
 * the moment the thing was first seen and frozen there.
 *
 * Pure. `now` is injected; no storage in here (see services/ExerciseLedger.ts).
 */

import type { Difficulty } from "../../../models/exercise";
import type { ExerciseSessionResult, SessionSummaryData } from "../../../models/session";
import { parseLocalDate } from "../../OfflineStorage";
import { difficultyRank, subjectFor } from "./subjects";
import type { NoveltyCandidate } from "./types";

// ── Tunables ────────────────────────────────────────────────────────────────

/** SessionService keeps this many; a full history may have dropped older ones. */
export const HISTORY_CAP = 50;
/** Runs remembered for idempotency and coverage. Must exceed HISTORY_CAP. */
const RECENT_RUNS = 80;

/**
 * The floor under any claim of novelty, and why each number:
 *  · 28 days observed — the first month of anyone's use is all firsts.
 *  · 8 sessions before it — two a week for a month is the smallest record a
 *    gap can mean anything against.
 *  · sessions in 3 of the 6 weeks before it — regular, not one burst in July.
 */
export const COVERAGE = {
  minObservedDays: 28,
  minPriorSessions: 8,
  minActiveWeeks: 3,
  weeks: 6,
} as const;

/** How long after a session its question could still be asked. */
export const CANDIDATE_HORIZON_MS = 48 * 3_600_000;

// ── The ledger ──────────────────────────────────────────────────────────────

export interface SeenEntry {
  firstSeen: string;
  firstAt: string;
  firstRunId: string;
  lastSeen: string;
  /** Coverage as it stood the moment this was first seen. Frozen. */
  priorSessions: number;
  observedSince: string | null;
  activeWeeks: number;
  /** Family entries: the hardest variant done in it so far. */
  maxDifficulty: Difficulty;
  /** Variant entries: the family's hardest BEFORE this variant, or null if the family was new. */
  familyMaxBefore?: Difficulty | null;
}

export interface SeenLedger {
  version: 1;
  /** The oldest session this ledger has proof of. */
  observedSince: string | null;
  /** Sessions with real work in them, ingested since `observedSince`. */
  sessionsSeen: number;
  /** Keyed by variant key, and by `fam:<familyKey>`. */
  subjects: Record<string, SeenEntry>;
  /** The newest runs ingested — what makes ingest idempotent. */
  recentRuns: { id: string; date: string; worked: boolean }[];
}

export function emptyLedger(): SeenLedger {
  return { version: 1, observedSince: null, sessionsSeen: 0, subjects: {}, recentRuns: [] };
}

const famKey = (family: string) => `fam:${family}`;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000,
  );
}

const completedSets = (r: ExerciseSessionResult) =>
  (r.setsCompleted ?? []).filter((s) => !s.skipped).length;

/**
 * Did they actually do it? At least one completed set. A skipped exercise is
 * stored as a result too (and so is everything after an early finish), and
 * treating those as "tried" would ask someone how an exercise went that they
 * chose not to do.
 */
export function wasTried(r: ExerciseSessionResult): boolean {
  return !r.skipped && completedSets(r) >= 1;
}

/**
 * Enough of it to feel tomorrow: two sets, or a minute of timed work. One
 * aborted set is trying, not training.
 */
export function wasPerformed(r: ExerciseSessionResult): boolean {
  return !r.skipped && (completedSets(r) >= 2 || (r.totalTimeSeconds ?? 0) >= 60);
}

function isValid(s: SessionSummaryData): boolean {
  return (
    !!s &&
    typeof s.sessionRunId === "string" &&
    typeof s.date === "string" &&
    typeof s.completedAt === "string" &&
    Array.isArray(s.exerciseResults)
  );
}

function byCompletion(a: SessionSummaryData, b: SessionSummaryData): number {
  return a.completedAt === b.completedAt
    ? a.sessionRunId.localeCompare(b.sessionRunId)
    : a.completedAt.localeCompare(b.completedAt);
}

/** Weeks, of the COVERAGE.weeks before `date`, holding at least one worked session. */
function activeWeeksBefore(runs: SeenLedger["recentRuns"], date: string): number {
  const weeks = new Set<number>();
  for (const r of runs) {
    if (!r.worked) continue;
    const d = daysBetween(r.date, date);
    if (d < 1 || d > COVERAGE.weeks * 7) continue;
    weeks.add(Math.floor((d - 1) / 7));
  }
  return weeks.size;
}

/**
 * Fold sessions into the ledger. Idempotent by `sessionRunId` — the player and
 * the summary screen both save the same run, and a second ingest must change
 * nothing.
 *
 * `fullHistory` marks a catch-up pass over the whole stored history. Only then
 * can a HOLE be seen: a full history whose oldest session was never ingested
 * may have dropped older ones unseen, so the ledger's proof moves forward to
 * that session. The claim gets shorter; it never gets wrong.
 */
export function ingestSessions(
  ledger: SeenLedger,
  sessions: readonly SessionSummaryData[],
  opts: { fullHistory?: boolean } = {},
): SeenLedger {
  const sorted = sessions.filter(isValid).sort(byCompletion);
  if (sorted.length === 0) return ledger;

  let observedSince = ledger.observedSince;
  let sessionsSeen = ledger.sessionsSeen;
  let recentRuns = ledger.recentRuns;
  const seen = new Set(recentRuns.map((r) => r.id));

  if (
    opts.fullHistory &&
    sorted.length >= HISTORY_CAP &&
    ledger.sessionsSeen > 0 &&
    !seen.has(sorted[0].sessionRunId)
  ) {
    observedSince = sorted[0].date;
    sessionsSeen = 0;
    recentRuns = [];
    seen.clear();
  }

  const fresh = sorted.filter((s) => !seen.has(s.sessionRunId));
  if (fresh.length === 0 && observedSince === ledger.observedSince) return ledger;

  const subjects: Record<string, SeenEntry> = { ...ledger.subjects };

  for (const s of fresh) {
    const since = observedSince ?? s.date;
    const coverage = {
      priorSessions: sessionsSeen,
      observedSince: since,
      activeWeeks: activeWeeksBefore(recentRuns, s.date),
    };
    let worked = false;

    for (const r of s.exerciseResults) {
      if (!wasTried(r)) continue;
      worked = true;
      const subj = subjectFor({
        exerciseId: r.exerciseId,
        name: r.exerciseName,
        category: r.category,
        difficulty: r.difficulty,
      });

      const fKey = famKey(subj.familyKey);
      const famBefore = subjects[fKey];
      subjects[fKey] = famBefore
        ? {
            ...famBefore,
            lastSeen: s.date,
            maxDifficulty:
              difficultyRank(subj.difficulty) > difficultyRank(famBefore.maxDifficulty)
                ? subj.difficulty
                : famBefore.maxDifficulty,
          }
        : {
            firstSeen: s.date,
            firstAt: s.completedAt,
            firstRunId: s.sessionRunId,
            lastSeen: s.date,
            ...coverage,
            maxDifficulty: subj.difficulty,
          };

      const variant = subjects[subj.variantKey];
      subjects[subj.variantKey] = variant
        ? { ...variant, lastSeen: s.date }
        : {
            firstSeen: s.date,
            firstAt: s.completedAt,
            firstRunId: s.sessionRunId,
            lastSeen: s.date,
            ...coverage,
            maxDifficulty: subj.difficulty,
            familyMaxBefore: famBefore ? famBefore.maxDifficulty : null,
          };
    }

    if (worked) sessionsSeen += 1;
    observedSince = since;
    recentRuns = [...recentRuns, { id: s.sessionRunId, date: s.date, worked }].slice(-RECENT_RUNS);
  }

  return { version: 1, observedSince, sessionsSeen, subjects, recentRuns };
}

// ── Detection ───────────────────────────────────────────────────────────────

function covered(entry: SeenEntry, triedOn: string): boolean {
  return (
    !!entry.observedSince &&
    daysBetween(entry.observedSince, triedOn) >= COVERAGE.minObservedDays &&
    entry.priorSessions >= COVERAGE.minPriorSessions &&
    entry.activeWeeks >= COVERAGE.minActiveWeeks
  );
}

/**
 * Would they plausibly feel it, or care? A new stretch does not leave anyone
 * sore, and marching in place is a warm-up, not an experience.
 */
function salient(r: ExerciseSessionResult, category: string): boolean {
  if (category === "flexibility") return false;
  if (category === "cardio" && r.difficulty === "beginner") return false;
  return true;
}

/** Did they train this category in the 6 weeks before `date`, outside this session? */
function trainedCategoryBefore(
  sessions: readonly SessionSummaryData[],
  category: string,
  date: string,
  runId: string,
): boolean {
  return sessions.some(
    (s) =>
      s.sessionRunId !== runId &&
      daysBetween(s.date, date) >= 0 &&
      daysBetween(s.date, date) <= COVERAGE.weeks * 7 &&
      s.exerciseResults.some((r) => r.category === category && wasTried(r)),
  );
}

/**
 * What in the last 48 hours was new — at most ONE per session, the one that
 * mattered most. A new programme can bring five new movements in one session;
 * the coach asks about the one they are most likely to feel.
 *
 * Only sessions the ledger has ingested are read: the ledger is the only thing
 * that can say "first".
 */
export function detectNovelty(
  ledger: SeenLedger,
  sessions: readonly SessionSummaryData[],
  now: Date,
): NoveltyCandidate[] {
  const ingested = new Set(ledger.recentRuns.map((r) => r.id));
  const nowMs = now.getTime();
  const out: NoveltyCandidate[] = [];

  for (const s of sessions) {
    if (!isValid(s) || !ingested.has(s.sessionRunId)) continue;
    const at = Date.parse(s.completedAt);
    if (!Number.isFinite(at) || at > nowMs || nowMs - at > CANDIDATE_HORIZON_MS) continue;

    let best: NoveltyCandidate | null = null;
    for (const r of s.exerciseResults) {
      if (!wasPerformed(r)) continue;
      const subj = subjectFor({
        exerciseId: r.exerciseId,
        name: r.exerciseName,
        category: r.category,
        difficulty: r.difficulty,
      });
      if (!salient(r, subj.category)) continue;

      const fam = ledger.subjects[famKey(subj.familyKey)];
      const variant = ledger.subjects[subj.variantKey];
      let novelty: NoveltyCandidate["novelty"] | null = null;
      let entry: SeenEntry | undefined;
      if (fam?.firstRunId === s.sessionRunId) {
        novelty = "family";
        entry = fam;
      } else if (
        variant?.firstRunId === s.sessionRunId &&
        variant.familyMaxBefore != null &&
        difficultyRank(subj.difficulty) > difficultyRank(variant.familyMaxBefore)
      ) {
        novelty = "harder";
        entry = variant;
      }
      if (!novelty || !entry || !covered(entry, s.date)) continue;

      let score = novelty === "family" ? 3 : 2;
      if (subj.difficulty === "advanced") score += 1;
      if (!trainedCategoryBefore(sessions, subj.category, s.date, s.sessionRunId)) score += 1;

      if (!best || score > best.score) {
        best = {
          kind: "exercise",
          variantKey: subj.variantKey,
          familyKey: subj.familyKey,
          label: subj.label,
          category: subj.category,
          difficulty: subj.difficulty,
          novelty,
          triedRunId: s.sessionRunId,
          triedAt: s.completedAt,
          triedOn: s.date,
          score,
          evidence: { sessionsBefore: entry.priorSessions, since: entry.observedSince as string },
        };
      }
    }
    if (best) out.push(best);
  }

  return out.sort((a, b) => b.triedAt.localeCompare(a.triedAt));
}
