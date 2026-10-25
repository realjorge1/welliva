/**
 * The cycle's lock-screen answers — "Started today", "It ended today", and the
 * two ways of saying no.
 *
 * What's locked here is everything the UI cannot show you: that the write lands
 * on the day the reminder ASKED about rather than the day it was pressed, that a
 * replayed response (a cold start re-delivers the same press) doesn't open a
 * second period, that "no" writes nothing at all, and that a press with tracking
 * switched off is refused instead of quietly re-enabling it.
 *
 * Also covered: the two categories really are attached to the two questions and
 * not to the heads-up, because an unregistered or missing `categoryIdentifier`
 * is exactly how these buttons would silently stop existing.
 *
 * `expo-notifications` is mocked; AsyncStorage is the in-memory one from
 * vitest.setup, so the cycle documents round-trip for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", TIME_INTERVAL: "timeInterval", DATE: "date" },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  requestPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  getPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: vi.fn(async (req: { identifier?: string }) => req.identifier ?? "id_1"),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  getAllScheduledNotificationsAsync: vi.fn(async () => []),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationCategoryAsync: vi.fn(async () => undefined),
}));

import * as Notifications from "expo-notifications";
import {
  CYCLE_ENDED_CATEGORY,
  CYCLE_REMINDER_CATEGORY,
  setWaterGlassMl,
} from "../notifications/categories";
import {
  declineCycleQuestion,
  logPeriodEndFromNotification,
  logPeriodStartFromNotification,
  subscribeCycleLogChanged,
} from "../notifications/cycleActions";
import {
  computeView,
  DEFAULT_CYCLE_SETTINGS,
  loadCycleData,
  liveEpisodes,
  planCycleReminders,
  predict,
  relayCycleReminders,
  savePeriods,
  saveSettings,
  syncCycleReminders,
  todayStatus,
  type CycleSettings,
  type PeriodEpisode,
} from "../cycle";
import { toLocalDateString } from "../OfflineStorage";

/** A reminder that fired at 09:00 local, `daysAgo` days back. */
function firedAt(daysAgo: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

const dayOf = (daysAgo: number) => toLocalDateString(new Date(firedAt(daysAgo)));
const today = () => dayOf(0);

const SETTINGS: CycleSettings = {
  ...DEFAULT_CYCLE_SETTINGS,
  enabled: true,
  usualCycleDays: 28,
  usualPeriodDays: 5,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

async function seed(periods: PeriodEpisode[], settings: Partial<CycleSettings> = {}) {
  await saveSettings({ ...SETTINGS, ...settings });
  await savePeriods(periods, true);
}

async function episodes(): Promise<PeriodEpisode[]> {
  return liveEpisodes((await loadCycleData()).periods);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await seed([]);
});

describe('"Started today"', () => {
  it("opens a period on the day the reminder asked about", async () => {
    const result = await logPeriodStartFromNotification(firedAt(0));

    expect(result).toMatchObject({ ok: true, kind: "checkin", date: today(), already: false });
    expect(await episodes()).toMatchObject([{ start: today(), end: null }]);
  });

  it("dates the period by the FIRE time, not by now", async () => {
    // The check-in fired yesterday morning and sat on the lock screen. Pressed
    // now, it is still an answer about yesterday.
    const result = await logPeriodStartFromNotification(firedAt(1));

    expect(result).toMatchObject({ ok: true, date: dayOf(1) });
    expect(await episodes()).toMatchObject([{ start: dayOf(1) }]);
  });

  it("never writes a start in the future", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await logPeriodStartFromNotification(tomorrow.getTime());

    expect(result).toMatchObject({ ok: true, date: today() });
    expect(await episodes()).toMatchObject([{ start: today() }]);
  });

  it("is idempotent — a replayed press reports success without a second period", async () => {
    await logPeriodStartFromNotification(firedAt(0));
    const second = await logPeriodStartFromNotification(firedAt(0));

    expect(second).toMatchObject({ ok: true, already: true });
    expect(await episodes()).toHaveLength(1);
  });

  it("reports a day already inside a logged period as already logged", async () => {
    await seed([{ id: "p1", start: dayOf(2), end: null, updatedAt: "2026-01-01T00:00:00.000Z" }]);

    const result = await logPeriodStartFromNotification(firedAt(0));

    expect(result).toMatchObject({ ok: true, already: true });
    expect(await episodes()).toHaveLength(1);
  });

  it("is refused when tracking has been switched off", async () => {
    await seed([], { enabled: false });

    const result = await logPeriodStartFromNotification(firedAt(0));

    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(await episodes()).toEqual([]);
  });

  it("announces the write, so the live app re-reads it", async () => {
    const seen: string[] = [];
    const off = subscribeCycleLogChanged(() => seen.push("changed"));
    await logPeriodStartFromNotification(firedAt(0));
    off();

    expect(seen).toEqual(["changed"]);
  });

  it("does not announce a refused press", async () => {
    await seed([], { enabled: false });
    const seen: string[] = [];
    const off = subscribeCycleLogChanged(() => seen.push("changed"));
    await logPeriodStartFromNotification(firedAt(0));
    off();

    expect(seen).toEqual([]);
  });
});

describe('"It ended today"', () => {
  it("closes the open period on the reminder's day", async () => {
    await seed([{ id: "p1", start: dayOf(5), end: null, updatedAt: "2026-01-01T00:00:00.000Z" }]);

    const result = await logPeriodEndFromNotification(firedAt(0));

    expect(result).toMatchObject({ ok: true, kind: "ended", date: today(), already: false });
    const [ep] = await episodes();
    expect(ep).toMatchObject({ start: dayOf(5), end: today() });
    // A logged end is EVIDENCE of how long her periods run; an assumed one is
    // excluded from the statistics. A button press is the former.
    expect(ep.endEstimated).toBeUndefined();
  });

  it("refuses when there is no period open to end", async () => {
    const result = await logPeriodEndFromNotification(firedAt(0));

    expect(result).toMatchObject({ ok: false, reason: "no-period" });
    expect(await episodes()).toEqual([]);
  });

  it("treats a period she already closed in the app as already logged", async () => {
    await seed([
      { id: "p1", start: dayOf(5), end: dayOf(1), updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await logPeriodEndFromNotification(firedAt(0));

    expect(result).toMatchObject({ ok: true, already: true });
    expect(await episodes()).toMatchObject([{ end: dayOf(1) }]);
  });
});

describe('"Not yet" / "Still going"', () => {
  it("writes nothing and names the day it was asked about", async () => {
    const before = await episodes();

    expect(declineCycleQuestion(firedAt(1))).toEqual({ date: dayOf(1) });
    expect(await episodes()).toEqual(before);
  });
});

describe("the headless re-lay", () => {
  it("derives the same moment the cycle screen shows", async () => {
    // `relayCycleReminders` calls predict + todayStatus directly instead of
    // computeView, so the headless task doesn't drag the food database in with
    // it. The whole refactor rests on those two giving the same answer the
    // screen's view does — if they ever diverge, a lock-screen answer would
    // re-lay a different plan from the one the dial implies.
    const periods: PeriodEpisode[] = [
      { id: "p1", start: dayOf(60), end: dayOf(56), updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "p2", start: dayOf(32), end: dayOf(28), updatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "p3", start: dayOf(4), end: null, updatedAt: "2026-01-03T00:00:00.000Z" },
    ];
    await seed(periods);

    const data = await loadCycleData();
    const ctx = { today: today(), profile: { age: 31, conditions: [] } };
    const view = computeView(data, ctx);
    const input = { episodes: data.periods, days: data.days, settings: data.settings, ...ctx };
    const prediction = predict(input);

    expect(prediction).toEqual(view.prediction);
    expect(todayStatus(input, prediction)).toEqual(view.status);

    // And the plan the two produce is byte-for-byte the same.
    const now = new Date();
    expect(
      planCycleReminders({ settings: data.settings, status: todayStatus(input, prediction), prediction, now }),
    ).toEqual(
      planCycleReminders({ settings: data.settings, status: view.status, prediction: view.prediction, now }),
    );
  });

  it("cancels everything once tracking is switched off", async () => {
    await seed([{ id: "p1", start: dayOf(2), end: null, updatedAt: "2026-01-01T00:00:00.000Z" }]);
    await relayCycleReminders();
    vi.clearAllMocks();

    await seed([], { enabled: false });
    expect(await relayCycleReminders()).toBe(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("the categories on the queue", () => {
  it("puts buttons on the two questions and none on the heads-up", async () => {
    await syncCycleReminders([
      { id: "welliva.cycle.headsup", kind: "headsup", at: new Date(Date.now() + 8.64e7), title: "t", body: "b" },
      { id: "welliva.cycle.checkin", kind: "checkin", at: new Date(Date.now() + 8.64e7), title: "t", body: "b" },
      { id: "welliva.cycle.ended", kind: "ended", at: new Date(Date.now() + 8.64e7), title: "t", body: "b" },
    ]);

    const calls = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
    const byId = new Map(
      calls.map(([req]) => [req.identifier, req.content as { categoryIdentifier?: string }]),
    );

    expect(byId.get("welliva.cycle.headsup")?.categoryIdentifier).toBeUndefined();
    expect(byId.get("welliva.cycle.checkin")?.categoryIdentifier).toBe(CYCLE_REMINDER_CATEGORY);
    expect(byId.get("welliva.cycle.ended")?.categoryIdentifier).toBe(CYCLE_ENDED_CATEGORY);
  });

  it("registers both cycle categories, with the words that go on the buttons", async () => {
    // Registration is memoized app-wide (a category only has to reach the OS
    // once); changing the water glass is the one documented way to force the
    // whole set to re-register, which is what makes it observable here.
    await setWaterGlassMl(300);

    const registered = new Map(
      vi
        .mocked(Notifications.setNotificationCategoryAsync)
        .mock.calls.map(([id, actions]) => [id, actions.map((a) => a.buttonTitle)]),
    );

    // A category the OS has never seen means a notification with no buttons.
    expect(registered.get(CYCLE_REMINDER_CATEGORY)).toEqual(["Started today", "Not yet"]);
    expect(registered.get(CYCLE_ENDED_CATEGORY)).toEqual(["It ended today", "Still going"]);
  });

  it("carries the kind, so one handler can tell the two questions apart", async () => {
    await syncCycleReminders([
      { id: "welliva.cycle.ended", kind: "ended", at: new Date(Date.now() + 8.64e7), title: "t", body: "b" },
    ]);

    const [[req]] = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
    expect(req.content.data).toMatchObject({ type: "cycle-reminder", kind: "ended", route: "/cycle" });
  });
});
