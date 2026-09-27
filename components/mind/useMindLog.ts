/**
 * useMindLog — reading the state-of-mind record back.
 *
 * One hook for every surface that shows mood rather than collects it: the Mind
 * panel on /knows, the sheet's prefill, and the Logs rows. It owns the shapes
 * the screens want (a day series, the words used most, what each life domain
 * tends to feel like) so none of that arithmetic gets re-derived per screen and
 * drift apart.
 *
 * ── ONE READING PER DAY ─────────────────────────────────────────────────────
 * Entries are no longer one-per-date: a day can hold several momentary entries
 * plus one daily. Everything below collapses to one reading per date first, the
 * same rule GozlinHabitEngine applies, because a talkative Tuesday must not
 * outvote a quiet Wednesday in an average that claims to be "per day".
 *
 * ── WHY IT REFETCHES ON FOCUS ───────────────────────────────────────────────
 * /knows is a (tabs) screen. Those mount once and are then shown and hidden, so
 * an effect with an empty dependency list runs exactly once per app launch and
 * the panel would show whatever was true the first time the tab was opened.
 * `reload` is exposed for a `useFocusEffect` in the host, which is the same fix
 * the Profile screen needed.
 */
import { useSystem } from "@/contexts/AppContext";
import {
  associationLabel,
  loadCheckins,
  readEntryValence,
  recordMindEntry,
  STRESS_LABELS,
  type GozlinCheckin,
} from "@/services/gozlin";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MindPayload } from "./MindSheet";

/** How far back the panel looks. Matches the store's 90-day retention. */
const WINDOW_DAYS = 90;
/** The series the panel draws. */
export const SERIES_DAYS = 14;

export interface MindDay {
  date: string;
  /** Mean valence across the day's entries, or null if none carried one. */
  valence: number | null;
  labels: string[];
  associations: string[];
  entries: number;
  stressed: boolean;
}

export interface AssociationRead {
  value: string;
  label: string;
  n: number;
  /** Mean valence of the entries that named it, or null. */
  avgValence: number | null;
}

export interface UseMindLog {
  loading: boolean;
  /** Every stored entry, oldest first. */
  entries: GozlinCheckin[];
  /** One row per logged date, oldest first, within the window. */
  days: MindDay[];
  /** The last SERIES_DAYS calendar days, including days with no entry. */
  series: MindDay[];
  /** Today's `daily` entry, for the sheet's prefill. */
  todayDaily: GozlinCheckin | null;
  /** How many entries exist for today, of both kinds. */
  todayCount: number;
  /** Mean valence across logged days in the series window. */
  average: number | null;
  /** Emotion words by frequency, most used first. */
  topLabels: { label: string; n: number }[];
  /** Life domains by frequency, with what each one tends to feel like. */
  associations: AssociationRead[];
  reload: () => Promise<void>;
  save: (payload: MindPayload) => Promise<void>;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Legacy 1–5 records still read — the same single bridge the engine uses. */
const readValence = (c: GozlinCheckin): number | null => readEntryValence(c);

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + deltaDays);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function useMindLog(): UseMindLog {
  const { currentDate } = useSystem();
  const [entries, setEntries] = useState<GozlinCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const list = await loadCheckins();
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadCheckins().then((list) => {
      if (!alive) return;
      setEntries(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cutoff = useMemo(() => shiftDate(currentDate, -WINDOW_DAYS), [currentDate]);

  const days = useMemo<MindDay[]>(() => {
    const byDate = new Map<
      string,
      { vs: number[]; labels: Set<string>; assoc: Set<string>; n: number; stressed: boolean }
    >();
    for (const c of entries) {
      if (!c?.date || c.date < cutoff) continue;
      const b =
        byDate.get(c.date) ??
        { vs: [], labels: new Set<string>(), assoc: new Set<string>(), n: 0, stressed: false };
      const v = readValence(c);
      if (v !== null) b.vs.push(v);
      for (const l of c.labels ?? []) {
        b.labels.add(l);
        if (STRESS_LABELS.has(l)) b.stressed = true;
      }
      for (const a of c.associations ?? []) b.assoc.add(a);
      if (typeof c.stress === "number" && c.stress >= 4) b.stressed = true;
      b.n += 1;
      byDate.set(c.date, b);
    }
    return [...byDate.entries()]
      .map(([date, b]) => ({
        date,
        valence: b.vs.length ? mean(b.vs) : null,
        labels: [...b.labels],
        associations: [...b.assoc],
        entries: b.n,
        stressed: b.stressed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, cutoff]);

  /**
   * The series includes days with NO entry, as explicit gaps. A mood chart that
   * silently closes over the days you didn't log draws a line through nothing
   * and invites you to read a trend that has no evidence under it.
   */
  const series = useMemo<MindDay[]>(() => {
    const byDate = new Map(days.map((d) => [d.date, d] as const));
    const out: MindDay[] = [];
    for (let i = SERIES_DAYS - 1; i >= 0; i--) {
      const date = shiftDate(currentDate, -i);
      out.push(
        byDate.get(date) ?? {
          date,
          valence: null,
          labels: [],
          associations: [],
          entries: 0,
          stressed: false,
        },
      );
    }
    return out;
  }, [days, currentDate]);

  const todayDaily = useMemo(
    () =>
      entries.find((c) => c.date === currentDate && (c.kind ?? "daily") === "daily") ??
      null,
    [entries, currentDate],
  );

  const todayCount = useMemo(
    () => entries.filter((c) => c.date === currentDate).length,
    [entries, currentDate],
  );

  const average = useMemo(() => {
    const vs = series.map((d) => d.valence).filter((v): v is number => v !== null);
    return vs.length ? mean(vs) : null;
  }, [series]);

  const topLabels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of entries) {
      if (!c?.date || c.date < cutoff) continue;
      for (const l of c.labels ?? []) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  }, [entries, cutoff]);

  /**
   * Per-domain valence — the reading that makes associations worth collecting.
   * Counted per ENTRY, not per day: naming Work in three separate moments of one
   * day is three pieces of evidence about work, which is exactly what makes it
   * different from the per-day averages above.
   */
  const associations = useMemo<AssociationRead[]>(() => {
    const buckets = new Map<string, { n: number; vs: number[] }>();
    for (const c of entries) {
      if (!c?.date || c.date < cutoff) continue;
      const v = readValence(c);
      for (const a of c.associations ?? []) {
        const b = buckets.get(a) ?? { n: 0, vs: [] };
        b.n += 1;
        if (v !== null) b.vs.push(v);
        buckets.set(a, b);
      }
    }
    return [...buckets.entries()]
      .map(([value, b]) => ({
        value,
        label: associationLabel(value),
        n: b.n,
        avgValence: b.vs.length ? mean(b.vs) : null,
      }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  }, [entries, cutoff]);

  const save = useCallback(
    async (payload: MindPayload) => {
      const list = await recordMindEntry({
        date: currentDate,
        kind: payload.kind,
        valence: payload.valence,
        labels: payload.labels,
        associations: payload.associations,
        sleepHours: payload.sleepHours,
        id: payload.id,
      });
      setEntries(list);
    },
    [currentDate],
  );

  return {
    loading,
    entries,
    days,
    series,
    todayDaily,
    todayCount,
    average,
    topLabels,
    associations,
    reload,
    save,
  };
}
