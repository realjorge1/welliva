import { describe, expect, it } from "vitest";

import { K } from "../platform/storage/keys";
import { ConsentRepository } from "../privacy/ConsentRepository";
import { NotificationScheduler } from "../notifications/NotificationScheduler";
import type { NotificationPort, ScheduleRequest } from "../notifications/NotificationPort";
import {
  deliveryMinute,
  inQuietHours,
  minutesOfDay,
  planNotifications,
  recordSent,
  type NotificationCandidate,
  type NotificationLedger,
  type NotificationPrefs,
} from "../notifications/orchestrator";
import { MemoryStore } from "./helpers/MemoryStore";

const PREFS: NotificationPrefs = {
  enabled: true,
  quietStart: "21:30",
  quietEnd: "07:30",
  dailyBudget: 3,
  cadenceDays: { briefing: 1, story: 7, anticipation: 0 },
};
const FOR = "2026-06-29";
const EMPTY: NotificationLedger = { sent: [] };

function cand(o: Partial<NotificationCandidate> & { id: string }): NotificationCandidate {
  return {
    category: "anticipation",
    title: "T",
    body: "B",
    priority: 50,
    preferredTime: "18:00",
    ...o,
  };
}

describe("orchestrator time helpers (pure)", () => {
  it("parses HH:MM to minutes, clamping garbage", () => {
    expect(minutesOfDay("07:30")).toBe(450);
    expect(minutesOfDay("99:99")).toBe(23 * 60 + 59);
  });

  it("detects quiet hours across a midnight-wrapping window", () => {
    expect(inQuietHours(minutesOfDay("22:00"), PREFS)).toBe(true);
    expect(inQuietHours(minutesOfDay("06:00"), PREFS)).toBe(true);
    expect(inQuietHours(minutesOfDay("12:00"), PREFS)).toBe(false);
  });

  it("shifts a morning-quiet time to the window end, drops a late-night one", () => {
    expect(deliveryMinute("06:00", PREFS)).toBe(minutesOfDay("07:30"));
    expect(deliveryMinute("22:00", PREFS)).toBeNull(); // would cross into tomorrow
    expect(deliveryMinute("12:00", PREFS)).toBe(minutesOfDay("12:00"));
  });
});

describe("planNotifications (pure policy)", () => {
  const NOW = new Date("2026-06-29T00:30:00");

  it("delivers nothing when disabled or budget 0", () => {
    expect(
      planNotifications({ candidates: [cand({ id: "a" })], prefs: { ...PREFS, enabled: false }, ledger: EMPTY, forDate: FOR, now: NOW }),
    ).toEqual([]);
    expect(
      planNotifications({ candidates: [cand({ id: "a" })], prefs: { ...PREFS, dailyBudget: 0 }, ledger: EMPTY, forDate: FOR, now: NOW }),
    ).toEqual([]);
  });

  it("ranks by priority and caps at the daily budget", () => {
    const out = planNotifications({
      candidates: [
        cand({ id: "low", priority: 40 }),
        cand({ id: "high", priority: 90 }),
        cand({ id: "mid", priority: 70 }),
        cand({ id: "min", priority: 10 }),
      ],
      prefs: { ...PREFS, dailyBudget: 2 },
      ledger: EMPTY,
      forDate: FOR,
      now: NOW,
    });
    expect(out.map((p) => p.id)).toEqual(["high", "mid"]);
  });

  it("skips a candidate already in the ledger (send-once)", () => {
    const ledger: NotificationLedger = { sent: [{ id: "a", category: "anticipation", date: "2026-06-20" }] };
    const out = planNotifications({ candidates: [cand({ id: "a" })], prefs: PREFS, ledger, forDate: FOR, now: NOW });
    expect(out).toEqual([]);
  });

  it("respects per-category cadence", () => {
    const ledger: NotificationLedger = { sent: [{ id: "story:old", category: "story", date: "2026-06-26" }] };
    const out = planNotifications({
      candidates: [cand({ id: "story:new", category: "story", priority: 80 })],
      prefs: PREFS,
      ledger,
      forDate: FOR, // 3 days later, cadence is 7 → skip
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("shifts out of quiet hours and drops slots already past", () => {
    const shifted = planNotifications({
      candidates: [cand({ id: "early", preferredTime: "06:00" })],
      prefs: PREFS,
      ledger: EMPTY,
      forDate: FOR,
      now: NOW,
    });
    expect(shifted).toHaveLength(1);
    expect(shifted[0].fireAt).toContain("T07:30");

    const past = planNotifications({
      candidates: [cand({ id: "x", preferredTime: "08:00" })],
      prefs: PREFS,
      ledger: EMPTY,
      forDate: FOR,
      now: new Date("2026-06-29T09:00:00"), // 08:00 already gone
    });
    expect(past).toEqual([]);
  });

  it("is deterministic for the same inputs", () => {
    const args = { candidates: [cand({ id: "a", priority: 80 }), cand({ id: "b", priority: 60 })], prefs: PREFS, ledger: EMPTY, forDate: FOR, now: NOW };
    expect(planNotifications(args)).toEqual(planNotifications(args));
  });
});

describe("recordSent", () => {
  it("appends delivered notifications and prunes old ones", () => {
    const ledger: NotificationLedger = { sent: [{ id: "ancient", category: "briefing", date: "2026-01-01" }] };
    const next = recordSent(ledger, [{ id: "briefing:2026-06-29", category: "briefing", title: "t", body: "b", fireAt: "x" }], FOR, 30);
    expect(next.sent.find((s) => s.id === "ancient")).toBeUndefined(); // pruned
    expect(next.sent.find((s) => s.id === "briefing:2026-06-29")).toBeDefined();
  });
});

describe("NotificationScheduler (consent + port gated)", () => {
  function fakePort(ready: boolean, scheduled: string[]): NotificationPort {
    return {
      getStatus: async () => ({ permission: ready ? "granted" : "denied", ready }),
      requestAccess: async () => ({ permission: "granted", ready: true }),
      schedule: async (r: ScheduleRequest) => {
        scheduled.push(r.id);
        return r.id;
      },
      cancel: async () => {},
      cancelAll: async () => {},
    };
  }
  const NOW = new Date("2026-06-29T00:30:00");
  const candidates: NotificationCandidate[] = [
    cand({ id: "briefing:2026-06-29", category: "briefing", title: "Morning", priority: 50, preferredTime: "08:00" }),
    cand({ id: "ant:life_1", priority: 85, preferredTime: "18:00" }),
  ];

  it("schedules nothing without consent", async () => {
    const scheduled: string[] = [];
    const sched = new NotificationScheduler(fakePort(true, scheduled), new MemoryStore(), new ConsentRepository(new MemoryStore()));
    const out = await sched.planAndSchedule(candidates, { now: NOW });
    expect(out).toEqual([]);
    expect(scheduled).toEqual([]);
  });

  it("schedules nothing when OS permission isn't ready", async () => {
    const scheduled: string[] = [];
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("proactive_notifications");
    const sched = new NotificationScheduler(fakePort(false, scheduled), new MemoryStore(), consent);
    expect(await sched.planAndSchedule(candidates, { now: NOW })).toEqual([]);
    expect(scheduled).toEqual([]);
  });

  it("plans + schedules + records once consent and permission are granted, idempotently", async () => {
    const scheduled: string[] = [];
    const store = new MemoryStore();
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("proactive_notifications");
    const sched = new NotificationScheduler(fakePort(true, scheduled), store, consent);

    const out = await sched.planAndSchedule(candidates, { now: NOW });
    expect(out.map((p) => p.id).sort()).toEqual(["ant:life_1", "briefing:2026-06-29"]);
    expect(scheduled.sort()).toEqual(["ant:life_1", "briefing:2026-06-29"]);

    // a second run the same day re-sends nothing (ledger de-dupes)
    const again = await sched.planAndSchedule(candidates, { now: NOW });
    expect(again).toEqual([]);

    const ledger = await store.get<NotificationLedger>(K.NOTIFICATIONS_LEDGER, { sent: [] });
    expect(ledger.sent).toHaveLength(2);
  });
});
