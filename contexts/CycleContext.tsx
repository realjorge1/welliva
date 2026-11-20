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
import { syncCycleCalendar } from "@/services/calendar/sync";
import {
  answerBleed as answerBleedRun,
  answerContraception,
  answerMethod,
  applyDayPatch,
  clearCycleReminders,
  computeView,
  DEFAULT_CYCLE_SETTINGS,
  endPeriod as endEpisode,
  episodeOn,
  eraseCycleData,
  FULL_SESSION_MEMORY,
  gozlinAsk as computeGozlinAsk,
  GOZLIN_ASK_LIMIT,
  givenWindow,
  loadCycleData,
  loadLifeMoments,
  mergeHungryLedger,
  moveCycleData,
  PERIOD_FLOWS,
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
  withRelief,
  type ContraceptionAnswer,
  type ContraceptionMethod,
  type CycleData,
  type CycleDayLog,
  type CycleSettings,
  type CycleView,
  type DayPatch as CycleDayPatch,
  type GozlinAsk,
  type GapNote,
  type LifeMoment,
  type Relief,
  type ReliefSymptom,
} from "@/services/cycle";
import { subscribeCycleLogChanged } from "@/services/notifications/cycleActions";
import { calorieFloor } from "@/services/NutritionService";
import { publishDayAdjustments } from "@/services/nutrition/dayTargets";
import { wholeDayIntake } from "@/services/nutrition/dayStatus";
import { forgetSmartFeature } from "@/services/smart/ledger";
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
import { useNutrition, useProfile, useSystem } from "./AppContext";
import { CycleLockProvider } from "./CycleLockContext";

/** A change to one day's log (services/cycle/dayWrite). */
export type DayPatch = CycleDayPatch;

export interface CycleSetup {
  /** Null for "I don't remember" — predictions wait for her first log. */
  lastStart: string | null;
  usualCycleDays: number | null;
  usualPeriodDays: number | null;
  /** "Do you use hormonal contraception?" — optional, so null when skipped. */
  contraception?: ContraceptionAnswer | null;
  /** "Which one?", after a yes (services/cycle/pill); null when skipped. */
  method?: ContraceptionMethod | null;
  /** The combined pill's pack length: 28 or 91. */
  packDays?: number;
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
  /** "Is this the start of your period?" — her answer, for the run of bleeding `date` belongs to. */
  answerBleed: (date: string, answer: "period" | "between") => Promise<void>;
  /** "What helped most?" — her answer, onto the symptom day's own log. */
  answerRelief: (date: string, symptom: ReliefSymptom, helped: Relief) => Promise<void>;
  /** "Skip" — kept too: three in a row and that symptom isn't asked about again. */
  skipRelief: (date: string, symptom: ReliefSymptom) => Promise<void>;
  updateSettings: (patch: Partial<CycleSettings>) => Promise<void>;
  setBackup: (on: boolean) => Promise<void>;
  /** Her answer to the contraception question. Switching away from "yes" restarts her history. */
  setContraception: (answer: ContraceptionAnswer) => Promise<void>;
  /** "Which one?" after a yes: the combined pill (and its pack), or another method. */
  setContraceptionMethod: (method: ContraceptionMethod, packDays?: number) => Promise<void>;
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
  /** Re-read her trips and events. Life Context has no change signal, so screens call this on focus. */
  refreshMoments: () => Promise<void>;
  /** The one-time water note is in front of her: it stays today, and never comes back. */
  noteWaterSeen: () => Promise<void>;
  /** "Plan for it", or the off switch. Off leaves the past as it was. */
  setHungryPlan: (on: boolean) => Promise<void>;
  /** "No thanks", for good. */
  declineHungryPlan: () => Promise<void>;
  /** Stop tracking. The log is kept and comes back if she turns it on again. */
  turnOff: () => Promise<void>;
  /** Erase the log everywhere: this phone, and (through the sync sweep) the backup. */
  eraseAll: () => Promise<void>;
}

const EMPTY: CycleData = { settings: { ...DEFAULT_CYCLE_SETTINGS }, periods: [], days: {} };

const CycleContext = createContext<CycleContextValue | null>(null);

const nowIso = () => new Date().toISOString();


export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { userBio, bodyLogs, nutritionTargets } = useProfile();
  const { dietHistory } = useNutrition();
  const { currentDate: today, isProfileReconciled } = useSystem();

  const [data, setData] = useState<CycleData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [shareWithGozlin, setShare] = useState(false);
  const [moments, setMoments] = useState<readonly LifeMoment[]>([]);
  const dataRef = useRef<CycleData>(EMPTY);
  const loadFailed = useRef(false);
  const todayRef = useRef(today);
  todayRef.current = today;

  const age = userBio?.age ?? null;
  const conditionsKey = (userBio?.medicalConditions ?? []).join(",");
  const heightM = (userBio?.heightCm ?? 0) / 100;
  const bmi = heightM > 0 && userBio?.weightKg ? Math.round((userBio.weightKg / (heightM * heightM)) * 10) / 10 : null;
  const profile = useMemo(
    () => ({ age, bmi, conditions: conditionsKey ? conditionsKey.split(",") : [] }),
    [age, bmi, conditionsKey],
  );
  const profileRef = useRef(profile);
  profileRef.current = profile;

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

  // Her trips and events, for "your period meets your calendar". Kept identical
  // when nothing changed, so an ordinary re-read doesn't recompute the view.
  const refreshMoments = useCallback(async () => {
    const next = await loadLifeMoments(todayRef.current);
    setMoments((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useEffect(() => {
    void refreshMoments();
  }, [today, isProfileReconciled, refreshMoments]);

  // A lock-screen answer, while this tree was alive. `load` goes through the
  // same lock the write did, so it can only ever read the post-write log.
  useEffect(() => subscribeCycleLogChanged(() => void load()), [load]);

  // The other half: the press was handled with the app suspended or killed, so
  // no in-process event could reach us. Re-read on the way back to the
  // foreground. Three AsyncStorage reads, and `remindersKey` is built from
  // primitives, so an unchanged log costs no re-lay.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void load();
        void refreshMoments();
      }
    });
    return () => sub.remove();
  }, [load, refreshMoments]);

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

  const weighIns = useMemo(() => bodyLogs.map((b) => ({ date: b.date, kg: b.weightKg })), [bodyLogs]);
  // WHOLE days only (said so, or inferred — services/nutrition/dayStatus): a
  // closed day with nothing logged is unknown, not 0 kcal, and a one-snack day
  // is not a day — read as one, it would look like the hungrier week ending.
  const intakeTarget = nutritionTargets?.calories ?? null;
  const intake = useMemo(() => wholeDayIntake(dietHistory, intakeTarget), [dietHistory, intakeTarget]);
  const usualKcal = nutritionTargets?.calories ?? null;
  const floorKcal = userBio ? calorieFloor(userBio) : null;
  const calories = useMemo(
    () => (usualKcal !== null && floorKcal !== null ? { targetKcal: usualKcal, floorKcal } : null),
    [usualKcal, floorKcal],
  );
  const view = useMemo(
    () => computeView(data, { today, profile, moments, weighIns, intake, calories }),
    [data, today, profile, moments, weighIns, intake, calories],
  );
  const viewRef = useRef(view);
  viewRef.current = view;
  const momentsRef = useRef(moments);
  momentsRef.current = moments;

  const patchSettings = useCallback(
    (patch: Partial<CycleSettings>) =>
      commit((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    [commit],
  );

  /* ── the hungrier-week plan ───────────────────────────────────────── */

  // Today and the future follow the plan; the past stays as it was. So the day
  // her period starts, the prediction moves on and today's extra stops by itself.
  const hungryLedger = data.settings.hungryLedger;
  useEffect(() => {
    if (!ready) return;
    const next = mergeHungryLedger(hungryLedger, view.hungryPlan, today);
    if (next !== hungryLedger) void patchSettings({ hungryLedger: next });
  }, [ready, hungryLedger, view.hungryPlan, today, patchSettings]);

  // The one thing every reader of a day's calorie target goes through.
  useEffect(() => {
    publishDayAdjustments(
      Object.fromEntries(
        Object.entries(hungryLedger).map(([date, kcal]) => [date, { kcal, reason: "cycle" as const }]),
      ),
    );
  }, [hungryLedger]);
  useEffect(() => () => publishDayAdjustments({}), []);

  /* ── reminders ────────────────────────────────────────────────────── */

  // Re-laid whenever what they depend on changes — a period logged today
  // cancels the check-in, discreet wording rewrites the copy. Debounced so a
  // run of taps on the day sheet costs one re-lay.
  const remindersKey = useMemo(() => {
    const s = data.settings;
    // The window she was GIVEN: the reminders are timed off it, and while she
    // is late the forecast rolls forward daily without changing the plan.
    const p = view.prediction ? givenWindow(view.prediction) : null;
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
      view.pill ? `${view.pill.latest}:${view.pill.missed}` : "",
      moments.map((m) => `${m.id}:${m.kind}:${m.start}:${m.end}`).join(","),
    ].join("|");
  }, [data.settings, view, moments]);

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
        planCycleReminders({
          settings: s,
          status: v.status,
          prediction: v.prediction,
          now: new Date(),
          moments: momentsRef.current,
          pill: v.pill,
        }),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [ready, remindersKey]);

  // Her calendar, when she has switched "Cycle in my calendar" on (services/
  // calendar): re-written when anything it shows moves — the likely days, the
  // fertile window and its own switch, discreet wording. A no-op while that
  // switch is off; it reads storage itself, so a short wait lets saves land.
  const calendarKey = useMemo(() => {
    const s = data.settings;
    const p = view.prediction;
    return [
      s.enabled,
      s.discreet,
      s.showFertileWindow,
      view.mode,
      p?.likely,
      p?.earliest,
      p?.latest,
      p?.periodLength,
      p?.cycleLength,
      p?.fertileStart,
      p?.fertileEnd,
      p?.fertileKnown,
      p?.afterNext?.earliest,
      p?.afterNext?.latest,
      p?.overdue ? "late" : "",
    ].join("|");
  }, [data.settings, view]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void syncCycleCalendar(), 1200);
    return () => clearTimeout(t);
  }, [ready, calendarKey]);

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
            // Skipping the question keeps whatever she said before (a log
            // turned off and on again), never erases it. "Which one?" only
            // ever follows a yes.
            contraception: (() => {
              const answered = setup.contraception
                ? answerContraception(d.settings.contraception, setup.contraception, todayRef.current)
                : d.settings.contraception;
              return setup.method ? answerMethod(answered, setup.method, setup.packDays) : answered;
            })(),
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
      commit((d) => applyDayPatch(d, date, patch, { today: todayRef.current, now: nowIso(), profile: profileRef.current })),
    [commit],
  );

  const answerBleed = useCallback(
    (date: string, answer: "period" | "between") =>
      commit((d) => answerBleedRun(d, date, answer, { today: todayRef.current, now: nowIso(), profile: profileRef.current })),
    [commit],
  );

  const noteRelief = useCallback(
    (date: string, symptom: ReliefSymptom, helped: Relief | "skipped") =>
      commit((d) => {
        const log = d.days[date];
        // Only onto a day that still carries the symptom: an answer about
        // nothing is no answer (and normalizeDayLog would drop it anyway).
        if (!log?.symptoms?.includes(symptom)) return d;
        return { ...d, days: { ...d.days, [date]: withRelief(log, symptom, helped, nowIso()) } };
      }),
    [commit],
  );

  const answerRelief = useCallback(
    (date: string, symptom: ReliefSymptom, helped: Relief) => noteRelief(date, symptom, helped),
    [noteRelief],
  );

  const skipRelief = useCallback(
    (date: string, symptom: ReliefSymptom) => noteRelief(date, symptom, "skipped"),
    [noteRelief],
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

  const setContraception = useCallback(
    (answer: ContraceptionAnswer) =>
      commit((d) => {
        const day = todayRef.current;
        // A bleed going on today is the first day of the first cycle after
        // stopping a method, so a restart counts from it (services/cycle/contraception).
        const bleeding = episodeOn(d.periods, day, day, viewRef.current.typicalBleed);
        const next = answerContraception(d.settings.contraception, answer, day, bleeding?.start ?? null);
        return next === d.settings.contraception ? d : { ...d, settings: { ...d.settings, contraception: next } };
      }),
    [commit],
  );

  const setContraceptionMethod = useCallback(
    (method: ContraceptionMethod, packDays?: number) =>
      commit((d) => {
        const next = answerMethod(d.settings.contraception, method, packDays);
        return next === d.settings.contraception ? d : { ...d, settings: { ...d.settings, contraception: next } };
      }),
    [commit],
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

  const setHungryPlan = useCallback(
    (on: boolean) =>
      patchSettings(
        // Switching it off is an answer too: the offer doesn't come back to ask
        // again, and the switch in cycle settings is always there.
        on
          ? { planHungryWeek: true, hungryPlanFrom: todayRef.current, hungryDeclined: false }
          : { planHungryWeek: false, hungryPlanFrom: null, hungryDeclined: true },
      ),
    [patchSettings],
  );

  const declineHungryPlan = useCallback(() => patchSettings({ hungryDeclined: true }), [patchSettings]);

  const noteWaterSeen = useCallback(
    () =>
      commit((d) =>
        d.settings.waterNoteOn ? d : { ...d, settings: { ...d.settings, waterNoteOn: todayRef.current } },
      ),
    [commit],
  );

  const turnOff = useCallback(() => patchSettings({ enabled: false }), [patchSettings]);

  const eraseAll = useCallback(
    () =>
      withCycleLock(async () => {
        await eraseCycleData();
        await clearCycleReminders();
        await consent.set("cycle_gozlin", false).catch(() => undefined);
        // The day the hungrier-week card appeared says something about her cycle too.
        await forgetSmartFeature("hungry-week").catch(() => undefined);
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
      answerBleed,
      answerRelief,
      skipRelief,
      updateSettings: patchSettings,
      setBackup,
      setContraception,
      setContraceptionMethod,
      setShareWithGozlin,
      answerGap,
      dismissNote,
      recordFullSession,
      dismissOffer,
      gozlinAsk,
      noteGozlinAsk,
      dismissGozlinAsk,
      refreshMoments,
      noteWaterSeen,
      setHungryPlan,
      declineHungryPlan,
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
      answerBleed,
      answerRelief,
      skipRelief,
      patchSettings,
      setBackup,
      setContraception,
      setContraceptionMethod,
      setShareWithGozlin,
      answerGap,
      dismissNote,
      recordFullSession,
      dismissOffer,
      gozlinAsk,
      noteGozlinAsk,
      dismissGozlinAsk,
      refreshMoments,
      noteWaterSeen,
      setHungryPlan,
      declineHungryPlan,
      turnOff,
      eraseAll,
    ],
  );

  // "Lock my cycle" sits inside, so it remounts with the account like the log
  // does, and every surface that reads the cycle can also read whether to hide it.
  return (
    <CycleContext.Provider value={value}>
      <CycleLockProvider>{children}</CycleLockProvider>
    </CycleContext.Provider>
  );
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
