/**
 * services/smart/arbiter.ts
 *
 * THE QUIET LAYER — which smart moment, if any, may speak.
 *
 * Eight features can now say something. Each one deciding on its own would be
 * eight voices, so they all ask here, and the answer is usually "not today":
 *
 *   · Nothing in the account's first {@link QUIET_FIRST_DAYS} days — there is
 *     nothing true to say about someone yet.
 *   · Nothing on a rough day. The only thing that day offers is the way out.
 *   · At most {@link MAX_PER_SURFACE} new moment per screen per day and
 *     {@link MAX_APP_WIDE} across the app. A moment already shown today keeps
 *     its place, so leaving a screen and coming back changes nothing.
 *   · Welcome back outranks everything, and on the day it appears it is the
 *     only thing that does.
 *   · Every answer is remembered: a moment inside its cool-down never returns.
 *
 * Pure: no storage. The ledger (./ledger) holds what was shown and answered.
 */
import type { GateState, ShownRecord, SmartAnswer, SmartCandidate, SmartSurface } from "./types";

/** One new suggestion per screen per day. */
export const MAX_PER_SURFACE = 1;

/** Two across the whole app per day. Calmer than it started, not louder. */
export const MAX_APP_WIDE = 2;

/** The first three days of an account hear nothing smart at all. */
export const QUIET_FIRST_DAYS = 3;

/** Whole calendar days from `from` to `to` (UTC arithmetic: no DST seams). */
export function daysFrom(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Inside the account's first days? Unknown age reads as "not new". */
export function inQuietStart(state: Pick<GateState, "today" | "accountSince">): boolean {
  if (!state.accountSince || state.accountSince > state.today) return false;
  return daysFrom(state.accountSince, state.today) < QUIET_FIRST_DAYS;
}

/** The latest answer to a moment, if any. */
export function answerFor(answers: readonly SmartAnswer[], id: string): SmartAnswer | null {
  let latest: SmartAnswer | null = null;
  for (const a of answers) {
    if (a.id === id && (!latest || a.at > latest.at)) latest = a;
  }
  return latest;
}

/** Is this moment inside the cool-down its last answer set? */
export function coolingDown(answers: readonly SmartAnswer[], id: string, today: string): boolean {
  const a = answerFor(answers, id);
  return !!a?.until && a.until >= today;
}

/**
 * The one moment `surface` may show now, or null.
 *
 * `candidates` are the moments that are true right now on this surface, each
 * feature having applied its own rules. This applies the rules they share.
 */
export function pickMoment(
  candidates: readonly SmartCandidate[],
  surface: SmartSurface,
  shown: readonly ShownRecord[],
  answers: readonly SmartAnswer[],
  state: GateState,
): SmartCandidate | null {
  if (state.roughDay || inQuietStart(state)) return null;

  const today = shown.filter((s) => s.date === state.today);
  const welcomedToday = today.some((s) => s.feature === "welcome-back");

  const eligible = candidates
    .filter((c) => !coolingDown(answers, c.id, state.today))
    // The day of a welcome back belongs to it.
    .filter((c) => !welcomedToday || c.feature === "welcome-back")
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const c of eligible) {
    if (canClaim(c, surface, today)) return c;
  }
  return null;
}

/**
 * Is a stronger moment waiting for the same screen's slot? The welcome and the
 * answers to what they just did don't compete; neither do rivals that are exempt.
 */
export function isOutranked(c: SmartCandidate, rivals: Iterable<SmartCandidate>): boolean {
  if (c.exempt || c.feature === "welcome-back") return false;
  for (const r of rivals) {
    if (!r.exempt && r.id !== c.id && r.priority > c.priority) return true;
  }
  return false;
}

/**
 * May `c` take a slot on `surface`, given what was shown today? A moment that
 * already holds a slot keeps it; an exempt one never needs one.
 */
export function canClaim(
  c: SmartCandidate,
  surface: SmartSurface,
  todayShown: readonly ShownRecord[],
): boolean {
  if (c.exempt) return true;
  if (c.feature === "welcome-back") return true;
  const counted = todayShown.filter((s) => !s.exempt);
  const here = counted.filter((s) => s.surface === surface);
  if (here.some((s) => s.id === c.id)) return true;
  if (here.length >= MAX_PER_SURFACE) return false;
  const appWide = new Set(counted.map((s) => s.id));
  if (appWide.has(c.id)) return true;
  return appWide.size < MAX_APP_WIDE;
}
