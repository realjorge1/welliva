/**
 * CycleContext — the cycle tracker's state, for every surface that shows it.
 *
 * One owner, so the Home card, the cycle screen, the Fitness tab's lighter
 * session, the Trust screen and Gozlin all read the same view of the same log.
 * Everything derived lives in services/cycle/view (pure); this file only loads,
 * persists and re-lays reminders.
 *
 * WHERE IT SITS. Inside the account-keyed AppProvider subtree (app/_layout), so
 * signing in as someone else or "Reset data" remounts it and it re-reads
 * storage — the same rule every provider here follows. It also re-reads when
 * the login reconcile finishes (`isProfileReconciled`), because on a fresh
 * device the backed-up log lands AFTER this has mounted.
 *
 * AND WHEN SOMETHING WROTE BEHIND ITS BACK. "Started today" on a lock-screen
 * reminder writes the episode straight to storage with no React tree involved
 * (services/notifications/cycleActions). Two doors bring that back here: the
 * in-process announcement, for a press handled while this tree was alive, and a
 * foreground re-read, for the half an in-process event cannot cross — the app
 * was suspended or killed when the button was pressed. Without both, the dial
 * would keep showing the old day until the next remount.
 *
 * Every write is serialized (withCycleLock) and reads the latest state from a
 * ref, so two quick taps on the day sheet can't overwrite each other.
 */
import { consent } from "@/health-os";
import {
  clearCycleReminders,
  computeView,
  DEFAULT_CYCLE_SETTINGS,
  endPeriod as endEpisode,
  episodeOn,
  eraseCycleData,
  FULL_SESSION_MEMORY,
  gozlinAsk as computeGozlinAsk,
  GOZLIN_ASK_LIMIT,
  isEmptyDayLog,
  loadCycleData,
  moveCycleData,
  planCycleReminders,
  pruneDays,
  removeEpisode,
  saveDays,
  savePeriods,
  saveSettings,
  seedPeriod,
  startPeriod as startEpisode,
  syncCycleReminders,
  togglePeriodDay as toggleEpisodeDay,
  withCycleLock,
  type CycleData,
  type CycleDayLog,
  type CycleMood,
  type CycleSettings,
  type CycleView,
  type Energy,
  type GozlinAsk,
  type Flow,
  type GapNote,
  type OvulationTest,
  type Symptom,
} from "@/services/cycle";
import { subscribeCycleLogChanged } from "@/services/notifications/cycleActions";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useProfile, useSystem } from "./AppContext";

/** A change to one day's log. `null` clears a field; `undefined` leaves it alone. */
export interface DayPatch {
  flow?: Flow | null;
  symptoms?: Symptom[];
  mood?: CycleMood | null;
  energy?: Energy | null;
  ovulationTest?: OvulationTest | null;
}

export interface CycleSetup {
  /** Null for "I don't remember" — predictions wait for her first log. */
  lastStart: string | null;
  usualCycleDays: number | null;
  usualPeriodDays: number | null;
}

interface CycleContextValue {
  ready: boolean;
  today: string;
  data: CycleData;
  settings: CycleSettings;
  view: CycleView;
  /** Consent `cycle_gozlin`: her cycle rides along in Gozlin chats. */
  shareWithGozlin: boolean;
  /** A profile the Home invitation is for, who hasn't answered it. */
  offerable: boolean;
  enable: (setup: CycleSetup) => Promise<void>;
  startPeriod: (date?: string) => Promise<void>;
  endPeriod: (date?: string) => Promise<void>;
  togglePeriodDay: (date: string, on: boolean) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  logDay: (date: string, patch: DayPatch) => Promise<void>;
  updateSettings: (patch: Partial<CycleSettings>) => Promise<void>;
  setBackup: (on: boolean) => Promise<void>;
  setShareWithGozlin: (on: boolean) => Promise<void>;
  answerGap: (cycleStart: string, answer: GapNote) => Promise<void>;
  dismissNote: (id: string, signature: string) => Promise<void>;
  recordFullSession: (date: string) => Promise<void>;
  dismissOffer: () => Promise<void>;
  /**
   * "Let Gozlin see your cycle", today, in words about today — or null when
   * this is not the moment. The predicate and the copy are pure
   * (services/cycle/brief); the card that renders it is
   * components/cycle/CycleGozlinAsk.
   */
  gozlinAsk: GozlinAsk | null;
  /** Count today against the ask's budget — the card calls it when it appears. */
  noteGozlinAsk: () => Promise<void>;
  /** "Not now", for good. */
  dismissGozlinAsk: () => Promise<void>;
  /** Stop tracking. The log is kept and comes back if she turns it on again. */
  turnOff: () => Promise<void>;
  /** Erase the log everywhere: this phone, and (through the sync sweep) the backup. */
  eraseAll: () => Promise<void>;
}

const EMPTY: CycleData = { settings: { ...DEFAULT_CYCLE_SETTINGS }, periods: [], days: {} };

const CycleContext = createContext<CycleContextValue | null>(null);

const nowIso = () => new Date().toISOString();

/** Flows that mean a period day. Spotting doesn't. */
const PERIOD_FLOWS: readonly Flow[] = ["light", "medium", "heavy"];

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { userBio } = useProfile();
  const { currentDate: today, isProfileReconciled } = useSystem();

  const [data, setData] = useState<CycleData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [shareWithGozlin, setShare] = useState(false);
  const dataRef = useRef<CycleData>(EMPTY);
  const loadFailed = useRef(false);
  const todayRef = useRef(today);
  todayRef.current = today;

  const age = userBio?.age ?? null;
  const conditionsKey = (userBio?.medicalConditions ?? []).join(",");
  const profile = useMemo(
    () => ({ age, conditions: conditionsKey ? conditionsKey.split(",") : [] }),
    [age, conditionsKey],
  );

  /* ── load ─────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    try {
      const [loaded, shared] = await Promise.all([
        withCycleLock(() => loadCycleData()),
        consent.isGranted("cycle_gozlin").catch(() => false),
      ]);
      dataRef.current = loaded;
      loadFailed.current = false;
      setData(loaded);
      setShare(shared);
    } catch (e) {
      // Fail-soft: an unreadable log shows as "not set up" rather than taking
      // Home and Settings down with it — and every write is refused until a
      // load succeeds, so the empty in-memory state can never overwrite it.
      loadFailed.current = true;
      console.warn("CycleContext: load failed", e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A fresh device: the backed-up log is downloaded by the login reconcile,
  // which finishes after this mounted. Read again once it has.
  const reconciledOnce = useRef(false);
  useEffect(() => {
    if (!isProfileReconciled || reconciledOnce.current) return;
    reconciledOnce.current = true;
    void load();
  }, [isProfileReconciled, load]);

  // A lock-screen answer, while this tree was alive. `load` goes through the
  // same lock the write did, so it can only ever read the post-write log.
  useEffect(() => subscribeCycleLogChanged(() => void load()), [load]);

  // The other half: the press was handled with the app suspended or killed, so
  // no in-process event could reach us. Re-read on the way back to the
  // foreground. Three AsyncStorage reads, and `remindersKey` is built from
  // primitives, so an unchanged log costs no re-lay.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => sub.remove();
  }, [load]);

  /* ── write ────────────────────────────────────────────────────────── */

  /**
   * Apply `fn` to the latest data and persist whichever documents it replaced.
   * A function that returns its input unchanged writes nothing.
   */
  const commit = useCallback((fn: (d: CycleData) => CycleData) => {
    return withCycleLock(async () => {
      if (loadFailed.current) return;
      const prev = dataRef.current;
      const next = fn(prev);
      if (next === prev) return;
      const settings =
        next.settings !== prev.settings ? { ...next.settings, updatedAt: nowIso() } : next.settings;
      const days = next.days !== prev.days ? pruneDays(next.days, todayRef.current) : next.days;
      const final: CycleData = { settings, periods: next.periods, days };
      dataRef.current = final;
      setData(final);
      const backupOn = final.settings.backupOn;
      if (final.settings !== prev.settings) await saveSettings(final.settings);
      if (final.periods !== prev.periods) {
        // The merge orders periods by stamp; writing them the same way means a
        // round trip through another phone doesn't read as a change.
        const ordered = [...final.periods].sort((a, b) =>
          a.updatedAt !== b.updatedAt ? (a.updatedAt < b.updatedAt ? -1 : 1) : a.id < b.id ? -1 : 1,
        );
        await savePeriods(ordered, backupOn);
      }
      if (final.days !== prev.days) await saveDays(final.days, backupOn);
    });
  }, []);

  const view = useMemo(() => computeView(data, { today, profile }), [data, today, profile]);
  const viewRef = useRef(view);
  viewRef.current = view;

  const patchSettings = useCallback(
    (patch: Partial<CycleSettings>) =>
      commit((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    [commit],
  );

  /* ── reminders ────────────────────────────────────────────────────── */

  // Re-laid whenever what they depend on changes — a period logged today
  // cancels the check-in, discreet wording rewrites the copy. Debounced so a
  // run of taps on the day sheet costs one re-lay.
  const remindersKey = useMemo(() => {
    const s = data.settings;
    const p = view.prediction;
    return [
      s.enabled,
      s.remindersOn,
      s.discreet,
      view.mode,
      view.status.inPeriod,
      view.status.periodOpen,
      view.status.periodStale,
      view.status.expectedEnd,
      p?.earliest,
      p?.likely,
      p?.latest,
    ].join("|");
  }, [data.settings, view]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const v = viewRef.current;
      const s = dataRef.current.settings;
      if (!s.enabled) {
        void clearCycleReminders();
        return;
      }
      void syncCycleReminders(
        planCycleReminders({ settings: s, status: v.status, prediction: v.prediction, now: new Date() }),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [ready, remindersKey]);

  // Postpartum: predictions restart from the first period after the birth.
  // The profile doesn't record when that was, so the first day this provider
  // sees postpartum on the profile is when the new history begins.
  useEffect(() => {
    if (!ready || view.mode !== "postpartum") return;
    if (!data.settings.enabled || data.settings.postpartumSince) return;
    void patchSettings({ postpartumSince: today });
  }, [ready, view.mode, data.settings.enabled, data.settings.postpartumSince, today, patchSettings]);

  /* ── actions ──────────────────────────────────────────────────────── */

  const enable = useCallback(
    (setup: CycleSetup) =>
      commit((d) => {
        const now = nowIso();
        const periodDays = setup.usualPeriodDays ?? 5;
        const periods = setup.lastStart
          ? seedPeriod(d.periods, setup.lastStart, periodDays, todayRef.current, now)
          : d.periods;
        return {
          ...d,
          periods,
          settings: {
            ...d.settings,
            enabled: true,
            enabledAt: d.settings.enabledAt ?? now,
            usualCycleDays: setup.usualCycleDays,
            usualPeriodDays: setup.usualPeriodDays,
            offerDismissed: true,
          },
        };
      }),
    [commit],
  );

  const startPeriod = useCallback(
    (date?: string) =>
      commit((d) => ({
        ...d,
        periods: startEpisode(d.periods, date ?? todayRef.current, todayRef.current, viewRef.current.typicalBleed, nowIso()),
      })),
    [commit],
  );

  const endPeriod = useCallback(
    (date?: string) =>
      commit((d) => ({
        ...d,
        periods: endEpisode(d.periods, date ?? todayRef.current, todayRef.current, viewRef.current.typicalBleed, nowIso()),
      })),
    [commit],
  );

  const togglePeriodDay = useCallback(
    (date: string, on: boolean) =>
      commit((d) => {
        const now = nowIso();
        const periods = toggleEpisodeDay(d.periods, date, on, todayRef.current, viewRef.current.typicalBleed, now);
        // A day that stops being a period day can't keep a period flow.
        const log = d.days[date];
        if (!on && log?.flow && PERIOD_FLOWS.includes(log.flow)) {
          const cleared: CycleDayLog = { ...log, updatedAt: now };
          delete cleared.flow;
          return { ...d, periods, days: { ...d.days, [date]: cleared } };
        }
        return { ...d, periods };
      }),
    [commit],
  );

  const removePeriod = useCallback(
    (id: string) =>
      commit((d) => ({
        ...d,
        periods: removeEpisode(d.periods, id, todayRef.current, viewRef.current.typicalBleed, nowIso()),
      })),
    [commit],
  );

  const logDay = useCallback(
    (date: string, patch: DayPatch) =>
      commit((d) => {
        if (date > todayRef.current) return d;
        const now = nowIso();
        const prev: CycleDayLog | undefined = d.days[date];
        const next: CycleDayLog = { ...(prev ?? { date }), date, updatedAt: now };
        const apply = <K extends keyof DayPatch>(key: K) => {
          const v = patch[key];
          if (v === undefined) return;
          if (v === null || (Array.isArray(v) && v.length === 0)) {
            delete (next as unknown as Record<string, unknown>)[key];
          } else {
            (next as unknown as Record<string, unknown>)[key] = Array.isArray(v) ? [...new Set(v)] : v;
          }
        };
        apply("flow");
        apply("symptoms");
        apply("mood");
        apply("energy");
        apply("ovulationTest");
        // Nothing logged, nothing to clear: don't create an empty day.
        if (isEmptyDayLog(next) && isEmptyDayLog(prev)) return d;

        // A period flow on a day outside any period makes it a period day.
        let periods = d.periods;
        if (next.flow && PERIOD_FLOWS.includes(next.flow) && !episodeOn(d.periods, date, todayRef.current, viewRef.current.typicalBleed)) {
          periods = toggleEpisodeDay(d.periods, date, true, todayRef.current, viewRef.current.typicalBleed, now);
        }
        return { ...d, periods, days: { ...d.days, [date]: next } };
      }),
    [commit],
  );

  const setBackup = useCallback(
    (on: boolean) =>
      withCycleLock(async () => {
        if (loadFailed.current) return;
        const prev = dataRef.current;
        if (prev.settings.backupOn === on) return;
        const moved = await moveCycleData(prev, on);
        dataRef.current = moved;
        setData(moved);
      }),
    [],
  );

  const setShareWithGozlin = useCallback(async (on: boolean) => {
    setShare(on);
    try {
      await consent.set("cycle_gozlin", on);
    } catch {
      setShare(!on);
    }
  }, []);

  const answerGap = useCallback(
    (cycleStart: string, answer: GapNote) =>
      commit((d) => ({
        ...d,
        settings: { ...d.settings, gapNotes: { ...d.settings.gapNotes, [cycleStart]: answer } },
      })),
    [commit],
  );

  const dismissNote = useCallback(
    (id: string, signature: string) =>
      commit((d) => ({
        ...d,
        settings: { ...d.settings, dismissedFlags: { ...d.settings.dismissedFlags, [id]: signature } },
      })),
    [commit],
  );

  const recordFullSession = useCallback(
    (date: string) =>
      commit((d) =>
        d.settings.fullSessionDays.includes(date)
          ? d
          : {
              ...d,
              settings: {
                ...d.settings,
                fullSessionDays: [...d.settings.fullSessionDays, date].sort().slice(-FULL_SESSION_MEMORY),
              },
            },
      ),
    [commit],
  );

  const dismissOffer = useCallback(() => patchSettings({ offerDismissed: true }), [patchSettings]);

  /* ── the Gozlin ask ───────────────────────────────────────────────── */

  // Whether she CAN use the coach is a billing question and belongs to the
  // card; the permission is worth having either way (see brief.ts).
  const gozlinAsk = useMemo(
    () =>
      computeGozlinAsk({
        settings: data.settings,
        sharing: shareWithGozlin,
        mode: view.mode,
        status: view.status,
        todayLog: view.todayLog,
        today,
      }),
    [data.settings, shareWithGozlin, view.mode, view.status, view.todayLog, today],
  );

  const noteGozlinAsk = useCallback(
    () =>
      commit((d) =>
        d.settings.gozlinAskDays.includes(todayRef.current)
          ? d
          : {
              ...d,
              settings: {
                ...d.settings,
                gozlinAskDays: [...d.settings.gozlinAskDays, todayRef.current]
                  .sort()
                  .slice(-GOZLIN_ASK_LIMIT),
              },
            },
      ),
    [commit],
  );

  const dismissGozlinAsk = useCallback(
    () => patchSettings({ gozlinAskDismissed: true }),
    [patchSettings],
  );

  const turnOff = useCallback(() => patchSettings({ enabled: false }), [patchSettings]);

  const eraseAll = useCallback(
    () =>
      withCycleLock(async () => {
        await eraseCycleData();
        await clearCycleReminders();
        await consent.set("cycle_gozlin", false).catch(() => undefined);
        // Kept as a fresh, empty settings record so the Home invitation doesn't
        // come straight back to someone who just deleted their log.
        const fresh: CycleData = {
          settings: { ...DEFAULT_CYCLE_SETTINGS, offerDismissed: true, updatedAt: nowIso() },
          periods: [],
          days: {},
        };
        await saveSettings(fresh.settings);
        dataRef.current = fresh;
        setData(fresh);
        setShare(false);
      }),
    [],
  );

  const offerable =
    ready &&
    userBio?.sex === "female" &&
    !data.settings.enabled &&
    !data.settings.offerDismissed &&
    view.mode !== "pregnancy" &&
    view.mode !== "menopause";

  const value = useMemo<CycleContextValue>(
    () => ({
      ready,
      today,
      data,
      settings: data.settings,
      view,
      shareWithGozlin,
      offerable,
      enable,
      startPeriod,
      endPeriod,
      togglePeriodDay,
      removePeriod,
      logDay,
      updateSettings: patchSettings,
      setBackup,
      setShareWithGozlin,
      answerGap,
      dismissNote,
      recordFullSession,
      dismissOffer,
      gozlinAsk,
      noteGozlinAsk,
      dismissGozlinAsk,
      turnOff,
      eraseAll,
    }),
    [
      ready,
      today,
      data,
      view,
      shareWithGozlin,
      offerable,
      enable,
      startPeriod,
      endPeriod,
      togglePeriodDay,
      removePeriod,
      logDay,
      patchSettings,
      setBackup,
      setShareWithGozlin,
      answerGap,
      dismissNote,
      recordFullSession,
      dismissOffer,
      gozlinAsk,
      noteGozlinAsk,
      dismissGozlinAsk,
      turnOff,
      eraseAll,
    ],
  );

  return <CycleContext.Provider value={value}>{children}</CycleContext.Provider>;
}

export function useCycle(): CycleContextValue {
  const ctx = useContext(CycleContext);
  if (!ctx) throw new Error("useCycle must be used inside CycleProvider");
  return ctx;
}

/** Null outside the provider — for shared surfaces that must never throw over it. */
export function useCycleOptional(): CycleContextValue | null {
  return useContext(CycleContext);
}
