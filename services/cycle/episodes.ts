/**
 * services/cycle/episodes.ts — editing periods, as pure functions.
 *
 * Three ways a period gets recorded, and each has its own honest meaning:
 *
 *   startPeriod(date)          "my period started" — opens an episode that runs
 *                              until she says it ended.
 *   endPeriod(date)            "it ended" — closes the period that day belongs to.
 *   togglePeriodDay(date, on)  the calendar: "this particular day was / wasn't a
 *                              period day".
 *
 * THE RULES THAT KEEP THE HISTORY TRUE
 *  · Never in the future. A prediction is not a log.
 *  · A period that resumes within two days of ending is the SAME period. Two
 *    episodes four days apart would read as a four-day cycle, and one stray tap
 *    would drag the average down for months.
 *  · Turning off a day in the middle of a period ENDS it the day before, rather
 *    than splitting it in two. Splitting would invent a cycle nobody had; the
 *    usual reason to switch a mid-period day off is "it had already stopped".
 *  · An unended period older than OPEN_LIMIT_DAYS was forgotten, not endless:
 *    its end is ASSUMED (typical length) and kept out of the period-length
 *    statistics until she says when it really ended.
 *  · Removal leaves a tombstone, so it survives a merge with another device.
 */

import { addDays, daysBetween, minDate } from "./dates";
import type { PeriodEpisode } from "./types";

/** An unended period this many days old is assumed to have ended. */
export const OPEN_LIMIT_DAYS = 10;
/** Missing days allowed between two runs of bleeding that are still one period. */
export const CONTINUATION_GAP_DAYS = 2;
/** Longest span `endPeriod` will accept as a single period. */
export const MAX_PERIOD_SPAN_DAYS = 14;
/** Tombstones older than this are dropped — long enough for any device to have synced. */
const TOMBSTONE_KEEP_DAYS = 365;

export function makeEpisodeId(): string {
  return `per_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Live episodes (no tombstones), oldest first, ties broken by id for stability. */
export function liveEpisodes(list: readonly PeriodEpisode[]): PeriodEpisode[] {
  return list
    .filter((e) => !e.deleted)
    .sort((a, b) =>
      a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
}

export interface ResolvedEnd {
  /** The last day of the period, inclusive. */
  end: string;
  /** Still open and recent enough to be running today. */
  ongoing: boolean;
  /** The end is a guess: an unended period gone stale, or one closed for her. */
  assumed: boolean;
}

/** Where an episode ends, including one that hasn't been ended yet. */
export function resolveEnd(
  ep: PeriodEpisode,
  today: string,
  typicalPeriodDays: number,
): ResolvedEnd {
  if (ep.end) return { end: ep.end, ongoing: false, assumed: !!ep.endEstimated };
  const age = daysBetween(ep.start, today);
  if (age < 0) return { end: ep.start, ongoing: false, assumed: true };
  if (age < OPEN_LIMIT_DAYS) return { end: today, ongoing: true, assumed: false };
  return {
    end: addDays(ep.start, Math.max(1, Math.round(typicalPeriodDays)) - 1),
    ongoing: false,
    assumed: true,
  };
}

/** The episode whose days include `date`, if any. */
export function episodeOn(
  list: readonly PeriodEpisode[],
  date: string,
  today: string,
  typicalPeriodDays: number,
): PeriodEpisode | null {
  for (const ep of liveEpisodes(list)) {
    if (date < ep.start) break;
    if (date <= resolveEnd(ep, today, typicalPeriodDays).end) return ep;
  }
  return null;
}

/** The latest episode with no end — at most one survives normalizeEpisodes. */
export function openEpisode(list: readonly PeriodEpisode[]): PeriodEpisode | null {
  const live = liveEpisodes(list);
  for (let i = live.length - 1; i >= 0; i -= 1) if (live[i].end === null) return live[i];
  return null;
}

/** The most recent period, ended or not. */
export function latestEpisode(list: readonly PeriodEpisode[]): PeriodEpisode | null {
  const live = liveEpisodes(list);
  return live.length ? live[live.length - 1] : null;
}

/**
 * Every period day, for painting a calendar: "logged" for days she recorded (or
 * that an ongoing period has covered so far), "assumed" for the guessed tail of
 * a period she never ended.
 */
export function periodDayMap(
  list: readonly PeriodEpisode[],
  today: string,
  typicalPeriodDays: number,
): Map<string, "logged" | "assumed"> {
  const out = new Map<string, "logged" | "assumed">();
  for (const ep of liveEpisodes(list)) {
    const { end, assumed } = resolveEnd(ep, today, typicalPeriodDays);
    const span = daysBetween(ep.start, end);
    for (let i = 0; i <= span; i += 1) {
      const day = addDays(ep.start, i);
      if (day > today) break;
      if (!out.has(day)) out.set(day, assumed && !ep.end && i > 0 ? "assumed" : "logged");
    }
  }
  return out;
}

function stamp(ep: PeriodEpisode, patch: Partial<PeriodEpisode>, now: string): PeriodEpisode {
  const next: PeriodEpisode = { ...ep, ...patch, updatedAt: now };
  if (!next.end || !next.endEstimated) delete next.endEstimated;
  if (!next.deleted) delete next.deleted;
  return next;
}

/**
 * Put the list into its one canonical shape: overlapping or touching episodes
 * merged into one, any unended period followed by a later one closed (it cannot
 * still be running), and old tombstones dropped.
 */
export function normalizeEpisodes(
  list: readonly PeriodEpisode[],
  today: string,
  typicalPeriodDays: number,
  now: string,
): PeriodEpisode[] {
  const typical = Math.max(1, Math.round(typicalPeriodDays));
  const cutoff = addDays(now.slice(0, 10), -TOMBSTONE_KEEP_DAYS);
  const tombstones = list.filter((e) => e.deleted && e.updatedAt.slice(0, 10) >= cutoff);
  const merged: PeriodEpisode[] = [];

  for (const original of liveEpisodes(list)) {
    const ep = { ...original };
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(ep);
      continue;
    }

    // An unended period with a later period after it has ended — close it at
    // its typical length, or the day before the next one, whichever is first.
    if (prev.end === null) {
      const assumed = addDays(prev.start, typical - 1);
      const end = minDate(assumed, addDays(ep.start, -1));
      if (end >= prev.start && daysBetween(end, ep.start) > CONTINUATION_GAP_DAYS + 1) {
        merged[merged.length - 1] = stamp(prev, { end, endEstimated: true }, now);
        merged.push(ep);
        continue;
      }
    }

    const prevEnd = merged[merged.length - 1].end ?? resolveEnd(prev, today, typical).end;
    if (daysBetween(prevEnd, ep.start) <= CONTINUATION_GAP_DAYS + 1) {
      // One period, recorded twice (two devices, or a tap on each half).
      const keep = merged[merged.length - 1];
      let end: string | null;
      let estimated = false;
      if (keep.end === null || ep.end === null) {
        end = null;
      } else if (ep.end > keep.end) {
        end = ep.end;
        estimated = !!ep.endEstimated;
      } else {
        end = keep.end;
        estimated = !!keep.endEstimated;
      }
      merged[merged.length - 1] = stamp(keep, { end, endEstimated: estimated }, now);
      tombstones.push(stamp(ep, { deleted: true }, now));
      continue;
    }
    merged.push(ep);
  }

  return [...merged, ...tombstones];
}

/** "My period started on `date`." Opens a period that runs until she ends it. */
export function startPeriod(
  list: readonly PeriodEpisode[],
  date: string,
  today: string,
  typicalPeriodDays: number,
  now: string,
  makeId: () => string = makeEpisodeId,
): PeriodEpisode[] {
  if (date > today) return [...list];
  if (episodeOn(list, date, today, typicalPeriodDays)) return [...list];
  const live = liveEpisodes(list);

  // Bleeding again within a couple of days of a period ending is that period.
  const before = live.filter((e) => e.start <= date).pop();
  if (before) {
    const { end } = resolveEnd(before, today, typicalPeriodDays);
    if (daysBetween(end, date) <= CONTINUATION_GAP_DAYS + 1) {
      return normalizeEpisodes(
        list.map((e) => (e.id === before.id ? stamp(e, { end: null }, now) : e)),
        today,
        typicalPeriodDays,
        now,
      );
    }
  }

  // A start a day or two before a logged period is that period, beginning earlier.
  const after = live.find((e) => e.start > date);
  if (after && daysBetween(date, after.start) <= CONTINUATION_GAP_DAYS + 1) {
    return normalizeEpisodes(
      list.map((e) => (e.id === after.id ? stamp(e, { start: date }, now) : e)),
      today,
      typicalPeriodDays,
      now,
    );
  }

  return normalizeEpisodes(
    [...list, { id: makeId(), start: date, end: null, updatedAt: now }],
    today,
    typicalPeriodDays,
    now,
  );
}

/**
 * Setup's answer to "when did your last period start?". If her usual length
 * has already passed, the period is recorded as ended on its usual last day —
 * ASSUMED, so that guess never counts as evidence of how long hers last.
 */
export function seedPeriod(
  list: readonly PeriodEpisode[],
  start: string,
  periodDays: number,
  today: string,
  now: string,
  makeId: () => string = makeEpisodeId,
): PeriodEpisode[] {
  if (start > today || episodeOn(list, start, today, periodDays)) return [...list];
  const usualEnd = addDays(start, Math.max(1, Math.round(periodDays)) - 1);
  const episode: PeriodEpisode =
    usualEnd < today
      ? { id: makeId(), start, end: usualEnd, endEstimated: true, updatedAt: now }
      : { id: makeId(), start, end: null, updatedAt: now };
  return normalizeEpisodes([...list, episode], today, periodDays, now);
}

/** "It ended on `date`." Closes the period that day belongs to. */
export function endPeriod(
  list: readonly PeriodEpisode[],
  date: string,
  today: string,
  typicalPeriodDays: number,
  now: string,
): PeriodEpisode[] {
  if (date > today) return [...list];
  const ep = liveEpisodes(list)
    .filter((e) => e.start <= date)
    .pop();
  if (!ep || daysBetween(ep.start, date) >= MAX_PERIOD_SPAN_DAYS) return [...list];
  return normalizeEpisodes(
    list.map((e) => (e.id === ep.id ? stamp(e, { end: date, endEstimated: false }, now) : e)),
    today,
    typicalPeriodDays,
    now,
  );
}

/** The calendar: "`date` was (or wasn't) a period day". */
export function togglePeriodDay(
  list: readonly PeriodEpisode[],
  date: string,
  on: boolean,
  today: string,
  typicalPeriodDays: number,
  now: string,
  makeId: () => string = makeEpisodeId,
): PeriodEpisode[] {
  if (date > today) return [...list];
  const covering = episodeOn(list, date, today, typicalPeriodDays);
  const normal = (next: PeriodEpisode[]) =>
    normalizeEpisodes(next, today, typicalPeriodDays, now);

  if (on) {
    if (covering) return [...list];
    const live = liveEpisodes(list);
    const before = live.filter((e) => e.start < date).pop();
    if (before) {
      const { end } = resolveEnd(before, today, typicalPeriodDays);
      if (daysBetween(end, date) <= CONTINUATION_GAP_DAYS + 1) {
        return normal(
          list.map((e) =>
            e.id === before.id
              ? stamp(e, { end: date === today ? null : date, endEstimated: false }, now)
              : e,
          ),
        );
      }
    }
    const after = live.find((e) => e.start > date);
    if (after && daysBetween(date, after.start) <= CONTINUATION_GAP_DAYS + 1) {
      return normal(list.map((e) => (e.id === after.id ? stamp(e, { start: date }, now) : e)));
    }
    return normal([
      ...list,
      { id: makeId(), start: date, end: date === today ? null : date, updatedAt: now },
    ]);
  }

  if (!covering) return [...list];
  const { end } = resolveEnd(covering, today, typicalPeriodDays);
  if (covering.start === date) {
    if (end === date) {
      return normal(list.map((e) => (e.id === covering.id ? stamp(e, { deleted: true }, now) : e)));
    }
    return normal(
      list.map((e) => (e.id === covering.id ? stamp(e, { start: addDays(date, 1) }, now) : e)),
    );
  }
  return normal(
    list.map((e) =>
      e.id === covering.id ? stamp(e, { end: addDays(date, -1), endEstimated: false }, now) : e,
    ),
  );
}

/** Remove one whole period (a mistaken log). */
export function removeEpisode(
  list: readonly PeriodEpisode[],
  id: string,
  today: string,
  typicalPeriodDays: number,
  now: string,
): PeriodEpisode[] {
  return normalizeEpisodes(
    list.map((e) => (e.id === id && !e.deleted ? stamp(e, { deleted: true }, now) : e)),
    today,
    typicalPeriodDays,
    now,
  );
}
