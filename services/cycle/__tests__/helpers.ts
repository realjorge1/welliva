import { addDays } from "../dates";
import {
  DEFAULT_CYCLE_SETTINGS,
  type CycleDayLog,
  type CycleDays,
  type CycleSettings,
  type PeriodEpisode,
} from "../types";

export const NOW = "2026-10-15T09:00:00.000Z";

let seq = 0;
export const nextId = () => `t${(seq += 1)}`;

/** A closed period from `start` lasting `days` days. */
export function period(start: string, days = 5, extra: Partial<PeriodEpisode> = {}): PeriodEpisode {
  return {
    id: nextId(),
    start,
    end: addDays(start, days - 1),
    updatedAt: NOW,
    ...extra,
  };
}

/** Periods every `lengths[i]` days from `first`, each `bleed` days long. */
export function history(first: string, lengths: number[], bleed = 5): PeriodEpisode[] {
  const out: PeriodEpisode[] = [period(first, bleed)];
  let start = first;
  for (const l of lengths) {
    start = addDays(start, l);
    out.push(period(start, bleed));
  }
  return out;
}

export function settings(patch: Partial<CycleSettings> = {}): CycleSettings {
  return { ...DEFAULT_CYCLE_SETTINGS, enabled: true, ...patch };
}

export function day(date: string, patch: Partial<CycleDayLog>): CycleDayLog {
  return { date, updatedAt: NOW, ...patch };
}

export function days(...logs: CycleDayLog[]): CycleDays {
  const out: CycleDays = {};
  for (const l of logs) out[l.date] = l;
  return out;
}
