/**
 * CURIOSITY — whether, and when, Gozlin asks about something new.
 *
 * The detector says what was new. This says what is worth ASKING about, and
 * the answer is usually "nothing": a coach who asks about every new thing is
 * a survey. Every rule below is a brake, and they compound:
 *
 *   switch → window → restraint → budget → back-off → never twice
 *
 * ── TIMING IS THE HUMAN PART ────────────────────────────────────────────────
 * A new movement shows up as soreness 12–24 hours later and peaks at 24–72.
 * Asked the same evening, the honest answer is "fine" and it means nothing;
 * asked three days later it is digging up the past. So a question exists only
 * inside its window, and one that was never asked in time is dropped — never
 * asked late.
 *
 * ── WHY SAMPLE THE SUBJECT, NOT THE DAY ─────────────────────────────────────
 * The habit tracker samples days ("about one day in two"). Here the window is
 * two mornings long, so a day draw mostly just moves the question to the
 * second morning, when it is nearly stale. Drawing on the subject instead
 * means some new things are simply never asked about, and the ones that are
 * get asked on the first morning — when the question is best.
 *
 * Pure: `now` injected, the log passed in, nothing stored here.
 */

import { stableHash } from "../GozlinTrackerHabits";
import type { CuriosityEntry, CuriosityStatus, NoveltyCandidate } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The window for a new exercise.
 *  · opens at the later of 05:00 the next local morning and 10 hours after
 *    the session — a 23:30 session opens at 09:30, not at 05:00 after five
 *    hours' sleep;
 *  · closes 48 hours after the session.
 */
export const EXERCISE_WINDOW = { morningHour: 5, minDelayHours: 10, closeAfterHours: 48 } as const;

/** Roughly 2 in 3 of the candidates that pass every other gate are asked. */
const SAMPLE_SKIP_ONE_IN = 3;

/** At most one question opened per local day, and two per rolling week. */
export const BUDGET = { perDay: 1, perWeek: 2 } as const;

/**
 * Days of silence after this many ignored in a row. Two ignored is a
 * pattern; four is a person who does not want to be asked, and a coach who
 * keeps asking is a notification with a face.
 */
const BACKOFF_DAYS = [0, 0, 7, 21, 60] as const;

/** How many agent turns may carry the question, then the capture line. */
export const CHAT_LIMITS = { askTurns: 3, captureTurns: 2 } as const;

export function exerciseWindow(triedAt: string): { opensAt: string; closesAt: string } {
  const at = new Date(triedAt);
  const morning = new Date(at);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(EXERCISE_WINDOW.morningHour, 0, 0, 0);
  const opens = Math.max(morning.getTime(), at.getTime() + EXERCISE_WINDOW.minDelayHours * HOUR);
  const closes = at.getTime() + EXERCISE_WINDOW.closeAfterHours * HOUR;
  return { opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() };
}

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN);

/** An open question whose window has closed is expired — computed, never stored late. */
export function effectiveStatus(entry: CuriosityEntry, now: Date): CuriosityStatus {
  if (entry.status === "open" && now.getTime() >= ms(entry.closesAt)) return "expired";
  return entry.status;
}

function isLive(entry: CuriosityEntry, now: Date): boolean {
  const t = now.getTime();
  return effectiveStatus(entry, now) === "open" && t >= ms(entry.opensAt) && t < ms(entry.closesAt);
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Questions ignored in a row, newest first, and when the newest of them ended.
 * An answer ends the streak; an open question is not counted either way.
 */
export function ignoredStreak(
  log: readonly CuriosityEntry[],
  now: Date,
): { streak: number; lastEndedAt: number | null } {
  const closed = [...log]
    .filter((e) => effectiveStatus(e, now) !== "open")
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  let streak = 0;
  let lastEndedAt: number | null = null;
  for (const e of closed) {
    if (effectiveStatus(e, now) === "answered") break;
    if (streak === 0) lastEndedAt = ms(e.closedAt) || ms(e.closesAt);
    streak++;
  }
  return { streak, lastEndedAt };
}

export function backoffDays(streak: number): number {
  return BACKOFF_DAYS[Math.min(streak, BACKOFF_DAYS.length - 1)];
}

/** The deterministic draw — stable per subject and session, across renders and days. */
export function sampledIn(candidate: Pick<NoveltyCandidate, "variantKey" | "triedRunId">): boolean {
  return stableHash(`${candidate.variantKey}|${candidate.triedRunId}`) % SAMPLE_SKIP_ONE_IN !== 0;
}

export function entryFor(candidate: NoveltyCandidate, now: Date): CuriosityEntry {
  const { opensAt, closesAt } = exerciseWindow(candidate.triedAt);
  return {
    id: `cq_${candidate.triedRunId}_${candidate.variantKey}`,
    kind: candidate.kind,
    variantKey: candidate.variantKey,
    familyKey: candidate.familyKey,
    label: candidate.label,
    category: candidate.category,
    novelty: candidate.novelty,
    triedRunId: candidate.triedRunId,
    triedAt: candidate.triedAt,
    triedOn: candidate.triedOn,
    evidence: candidate.evidence,
    openedAt: now.toISOString(),
    opensAt,
    closesAt,
    status: "open",
    turnsCarried: 0,
    captureTurns: 0,
    updatedAt: now.toISOString(),
  };
}

export interface SelectInput {
  candidates: readonly NoveltyCandidate[];
  log: readonly CuriosityEntry[];
  now: Date;
  /** The Trust switch AND the tier. Off means nothing, anywhere. */
  enabled: boolean;
}

/**
 * The one question that is due right now, or null — which is the usual answer.
 *
 * `isNew` says the caller must record it as opened (once; never on render).
 * An already-open question is returned as-is so it survives remounts.
 */
export function selectQuestion(
  input: SelectInput,
): { question: CuriosityEntry; isNew: boolean } | null {
  const { candidates, log, now, enabled } = input;
  if (!enabled) return null;
  const t = now.getTime();

  // At most one open. If one is live, it IS the question.
  const live = [...log]
    .filter((e) => isLive(e, now))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
  if (live) return { question: live, isNew: false };

  // Budget.
  const today = localDay(now);
  const openedToday = log.filter((e) => localDay(new Date(e.openedAt)) === today).length;
  if (openedToday >= BUDGET.perDay) return null;
  const openedThisWeek = log.filter((e) => t - ms(e.openedAt) < 7 * DAY).length;
  if (openedThisWeek >= BUDGET.perWeek) return null;

  // Back-off.
  const { streak, lastEndedAt } = ignoredStreak(log, now);
  const rest = backoffDays(streak);
  if (rest > 0 && lastEndedAt != null && t < lastEndedAt + rest * DAY) return null;

  // Never twice: not the same session's subject, and never the same family.
  const askedFamilies = new Set(log.map((e) => e.familyKey));
  const askedRuns = new Set(log.map((e) => `${e.triedRunId}|${e.variantKey}`));

  const eligible = candidates.filter((c) => {
    if (askedFamilies.has(c.familyKey)) return false;
    if (askedRuns.has(`${c.triedRunId}|${c.variantKey}`)) return false;
    const { opensAt, closesAt } = exerciseWindow(c.triedAt);
    if (t < ms(opensAt) || t >= ms(closesAt)) return false;
    return sampledIn(c);
  });
  if (eligible.length === 0) return null;

  const pick = [...eligible].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : b.triedAt.localeCompare(a.triedAt),
  )[0];
  return { question: entryFor(pick, now), isNew: true };
}

// ── The conversation's share of a question ──────────────────────────────────

export type ChatStage = "ask" | "capture";

/**
 * What the state block carries for this question this turn.
 *
 *   ask     — not yet asked, and fewer than CHAT_LIMITS.askTurns turns have
 *             carried it. Past that the line stops: the model was offered the
 *             moment three times and none fitted, and a fourth offer is
 *             pressure, not an opening. The chip still holds the question.
 *   capture — a reply asked it; the next turns say "if this answers it,
 *             record it — and do not ask again".
 */
export function chatStage(entry: CuriosityEntry | null, now: Date): ChatStage | null {
  if (!entry || !isLive(entry, now)) return null;
  if (!entry.askedInChatAt) {
    return entry.turnsCarried < CHAT_LIMITS.askTurns ? "ask" : null;
  }
  return entry.captureTurns < CHAT_LIMITS.captureTurns ? "capture" : null;
}

/** What one agent turn did with the question. */
export interface TurnOutcome {
  stage: ChatStage | null;
  /** The reply asked it (see recall.askedInReply). */
  asked: boolean;
  /** note_experience recorded an answer this turn. */
  noted: boolean;
}

/** The entry after a turn. Pure — the caller persists it. */
export function afterTurn(entry: CuriosityEntry, outcome: TurnOutcome, now: Date): CuriosityEntry {
  const at = now.toISOString();
  if (outcome.noted) return { ...entry, status: "answered", closedAt: at, updatedAt: at };
  if (outcome.stage === "ask") {
    return {
      ...entry,
      turnsCarried: entry.turnsCarried + 1,
      ...(outcome.asked ? { askedInChatAt: at } : {}),
      updatedAt: at,
    };
  }
  if (outcome.stage === "capture") {
    const captureTurns = entry.captureTurns + 1;
    return captureTurns >= CHAT_LIMITS.captureTurns
      ? { ...entry, captureTurns, status: "ignored", closedAt: at, updatedAt: at }
      : { ...entry, captureTurns, updatedAt: at };
  }
  return entry;
}

export function markAnswered(entry: CuriosityEntry, now: Date): CuriosityEntry {
  const at = now.toISOString();
  return { ...entry, status: "answered", closedAt: at, updatedAt: at };
}

export function markDismissed(entry: CuriosityEntry, now: Date): CuriosityEntry {
  const at = now.toISOString();
  return { ...entry, status: "dismissed", closedAt: at, updatedAt: at };
}

/**
 * Should the chip show? Only while the question is live and the conversation
 * has not asked it already — the same question twice, once in chat and once
 * as a chip, is exactly the "programmed" feel this avoids.
 */
export function chipVisible(entry: CuriosityEntry | null, now: Date): boolean {
  return !!entry && isLive(entry, now) && !entry.askedInChatAt;
}
