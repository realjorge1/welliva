import { describe, expect, it } from "vitest";
import { buildCycleBrief, cycleStateLines } from "../brief";
import { cycleEase, headsUps, ironFromLog, ironMoment, ironReference, IRON_GOOD_SOURCE_MG } from "../care";
import { addDays } from "../dates";
import { cycleCsv, doctorSummary } from "../exportData";
import { timingPatterns } from "../patterns";
import { buildCycles, predict, todayStatus, type CycleToday } from "../predict";
import { planCycleReminders, reminderCopy } from "../reminderPlan";
import { computeView } from "../view";
import { day, days, history, NOW, nextId, period, settings } from "./helpers";

const TODAY = "2026-10-15";

describe("cycleEase — the lighter session", () => {
  const base = { enabled: true, mode: "normal" as const, today: TODAY, fullSessionDays: [] as string[] };

  it("eases only when she logged cramps or a heavy flow today", () => {
    expect(cycleEase({ ...base, days: {} })).toBeNull();
    expect(cycleEase({ ...base, days: days(day(TODAY, { flow: "light" })) })).toBeNull();
    const cramps = cycleEase({ ...base, days: days(day(TODAY, { symptoms: ["cramps"] })) })!;
    expect(cramps.headline).toBe("You logged cramps — a lighter version of today's session");
    expect(cramps.auto).toBe(true);
    const both = cycleEase({ ...base, days: days(day(TODAY, { symptoms: ["cramps"], flow: "heavy" })) })!;
    expect(both.dose).toBe("Eased for today's cramps and heavy flow");
  });

  it("learns: after choosing the full session on two of the last three such days, it offers instead", () => {
    const past = ["2026-08-20", "2026-09-17", "2026-09-18"];
    const logs = days(
      ...past.map((d) => day(d, { symptoms: ["cramps"] })),
      day(TODAY, { symptoms: ["cramps"] }),
    );
    const learned = cycleEase({ ...base, days: logs, fullSessionDays: ["2026-09-17", "2026-09-18"] })!;
    expect(learned.auto).toBe(false);
    expect(learned.learnedNote).toBe(
      "You chose the full session on 2 of your last 3 days like this, so today stays as planned.",
    );
    expect(cycleEase({ ...base, days: logs, fullSessionDays: ["2026-08-20"] })!.auto).toBe(true);
  });

  it("is off in pregnancy and when tracking is off", () => {
    const logs = days(day(TODAY, { symptoms: ["cramps"] }));
    expect(cycleEase({ ...base, mode: "pregnancy", days: logs })).toBeNull();
    expect(cycleEase({ ...base, enabled: false, days: logs })).toBeNull();
  });
});

describe("iron", () => {
  const item = (name: string, iron: number, foodId: string | null = null) => ({
    name,
    foodId,
    quantity: 1,
    unit: "cup",
    nutrients: { iron },
  });

  it("picks iron-rich foods she already eats, using the FDA 'good source' line", () => {
    expect(IRON_GOOD_SOURCE_MG).toBe(1.8);
    const picks = ironFromLog(
      [
        { date: "2026-09-01", items: [item("Beans", 4.3, "beans"), item("Rice", 1.9, "rice")] },
        { date: "2026-09-08", items: [item("Beans", 4.3, "beans"), item("Banana", 0.3)] },
        { date: "2026-09-10", items: [item("Lentils", 6.6, "lentils")] },
        { date: "2026-01-01", items: [item("Liver", 9, "liver")] }, // before the window
      ],
      "2026-07-17",
    );
    expect(picks.map((p) => p.name)).toEqual(["Beans", "Lentils", "Rice"]);
    expect(picks[0]).toMatchObject({ ironMg: 4.3, days: 2, source: "yours", portion: "1 cup" });
  });

  it("falls back to measured reference foods, filtered for her diet and allergies", () => {
    const vegan = ironReference("vegan");
    expect(vegan.length).toBeGreaterThan(0);
    expect(vegan.every((p) => p.source === "reference")).toBe(true);
    expect(vegan.map((p) => p.name).join(" ")).not.toMatch(/beef|egusi|moi/i);
    const omni = ironReference("none", ["eggs"]);
    expect(omni.map((p) => p.name).join(" ")).not.toMatch(/moi/i);
    expect(omni[0].ironMg).toBeGreaterThanOrEqual(omni[omni.length - 1].ironMg);
  });

  it("knows a heavy moment: today, during a heavy period, and three days after", () => {
    const status = { inPeriod: false } as CycleToday;
    const episodes = [period("2026-10-05", 5)]; // 5–9 Oct
    const heavyPeriod = days(day("2026-10-06", { flow: "heavy" }));
    expect(ironMoment({ today: "2026-10-11", days: heavyPeriod, episodes, status })).toBe("heavy-period");
    expect(ironMoment({ today: "2026-10-13", days: heavyPeriod, episodes, status })).toBeNull();
    expect(
      ironMoment({ today: TODAY, days: days(day(TODAY, { flow: "heavy" })), episodes: [], status }),
    ).toBe("heavy-today");
    expect(
      ironMoment({
        today: "2026-10-06",
        days: {},
        episodes,
        status: { inPeriod: true } as CycleToday,
        conditions: ["anemia"],
      }),
    ).toBe("anemia");
  });
});

describe("heads-ups from her own patterns", () => {
  const episodes = history("2026-06-01", [28, 28, 28]); // starts 1 Jun, 29 Jun, 27 Jul, 24 Aug
  const starts = ["2026-06-01", "2026-06-29", "2026-07-27"];
  const logs = days(
    ...starts.flatMap((s) => [
      day(s, { symptoms: ["cramps"] }),
      day(addDays(s, 26), { symptoms: ["headache"] }),
      day(addDays(s, 27), { symptoms: ["headache"] }),
    ]),
  );
  const s = settings({ usualCycleDays: 28 });

  it("speaks on the right day before her period, and on day 1 during it", () => {
    const cycles = buildCycles(episodes, s, TODAY);
    const patterns = timingPatterns(cycles, logs);
    const before = { episodes, days: logs, settings: s, today: "2026-09-19", profile: {} };
    const p = predict(before)!;
    expect(p.likely).toBe("2026-09-21");
    const st = todayStatus(before, p);
    const ups = headsUps(patterns, st, p);
    expect(ups.map((u) => u.text)).toContain(
      "Headaches have tended to show up about now for you, 1–2 days before your period.",
    );

    const during = { ...before, episodes: [...episodes, { id: nextId(), start: "2026-09-21", end: null, updatedAt: NOW }], today: "2026-09-21" };
    const p2 = predict(during)!;
    const ups2 = headsUps(patterns, todayStatus(during, p2), p2);
    expect(ups2.map((u) => u.text)).toContain("Cramps usually show up around now for you (on day 1 of your period).");
  });
});

describe("reminders", () => {
  const view = (today: string) => {
    const episodes = history("2026-04-01", [28, 28, 28, 28, 28, 28]); // last start 16 Sep
    const s = settings({ usualCycleDays: 28 });
    const v = computeView({ settings: s, periods: episodes, days: {} }, { today, profile: {} });
    return { s, v };
  };

  it("never names the period on a lock screen while discreet wording is on", () => {
    for (const kind of ["headsup", "checkin", "ended"] as const) {
      const c = reminderCopy(kind, true, null);
      expect(`${c.title} ${c.body}`).not.toMatch(/period|cycle|bleed/i);
    }
    expect(reminderCopy("checkin", false, null).title).toBe("Has your period started?");
  });

  it("lays a heads-up two days before the window and a check-in after the likely day", () => {
    const { s, v } = view("2026-10-01");
    const plan = planCycleReminders({ settings: s, status: v.status, prediction: v.prediction, now: new Date(2026, 9, 1, 12) });
    expect(plan.map((r) => r.kind)).toEqual(["headsup", "checkin"]);
    const headsup = plan[0].at;
    expect([headsup.getFullYear(), headsup.getMonth() + 1, headsup.getDate(), headsup.getHours()]).toEqual([2026, 10, 10, 9]);
  });

  it("drops anything already past, and lays nothing when switched off", () => {
    const { s, v } = view("2026-10-13");
    const plan = planCycleReminders({ settings: s, status: v.status, prediction: v.prediction, now: new Date(2026, 9, 13, 12) });
    expect(plan.map((r) => r.kind)).toEqual(["checkin"]);
    expect(
      planCycleReminders({ settings: { ...s, remindersOn: false }, status: v.status, prediction: v.prediction, now: new Date(2026, 9, 1) }),
    ).toEqual([]);
  });

  it("asks whether an open period has ended, the day after it usually would", () => {
    const episodes = [...history("2026-04-01", [28, 28, 28]), { id: nextId(), start: "2026-10-13", end: null, updatedAt: NOW }];
    const s = settings({ usualCycleDays: 28 });
    const v = computeView({ settings: s, periods: episodes, days: {} }, { today: TODAY, profile: {} });
    const plan = planCycleReminders({ settings: s, status: v.status, prediction: v.prediction, now: new Date(2026, 9, 15, 8) });
    expect(plan.map((r) => r.kind)).toEqual(["ended"]);
    expect(plan[0].at.getDate()).toBe(18);
  });
});

describe("the Gozlin brief", () => {
  it("carries only the cycle day, the window and today's log — and hides fertility unless she shows it", () => {
    const status = {
      mode: "normal",
      predicting: true,
      cycleDay: 15,
      inPeriod: false,
      periodDay: null,
      periodOpen: false,
      periodStale: false,
      phase: "fertile",
      toLikely: 14,
      toEarliest: 12,
      toLatest: 16,
      lateBy: 0,
      expectedEnd: null,
      ringDays: 29,
    } as CycleToday;
    const brief = buildCycleBrief({
      status,
      prediction: { basedOn: 4, cycleLength: 29 } as never,
      todayLog: day(TODAY, { symptoms: ["headache"], energy: "low" }),
      showFertileWindow: false,
    });
    expect(brief).toMatchObject({ cycleDay: 15, phase: "mid-cycle", nextPeriodFrom: 12, nextPeriodTo: 16, typicalCycleDays: 29 });
    const lines = cycleStateLines(brief).join("\n");
    expect(lines).toContain("cycle day 15 (mid-cycle)");
    expect(lines).toContain("next period likely in 12–16 days");
    expect(lines).toContain("logged today: headache, energy: low");
    expect(lines).not.toMatch(/fertile/);
  });

  it("is empty with no brief", () => {
    expect(cycleStateLines(null)).toEqual([]);
  });
});

describe("export", () => {
  it("writes a doctor summary with the numbers that matter", () => {
    const episodes = history("2026-04-01", [27, 29, 28, 30]);
    const s = settings();
    const v = computeView({ settings: s, periods: episodes, days: days(day("2026-04-01", { symptoms: ["cramps"] })) }, { today: TODAY, profile: {} });
    const text = doctorSummary({
      data: { settings: s, periods: episodes, days: days(day("2026-04-01", { symptoms: ["cramps"] })) },
      cycles: v.cycles,
      prediction: v.prediction,
      notes: v.allNotes,
      today: TODAY,
    });
    expect(text).toContain("Cycle length (start to start), last 4: 27, 29, 28, 30 days.");
    expect(text).toContain("Median 28.5 days; range 27–30 days.");
    expect(text).toContain("Most logged: cramps (1 day).");
    expect(text).toContain("not a medical record");
  });

  it("exports every period and logged day as CSV, quoting what needs it", () => {
    const csv = cycleCsv({
      settings: settings(),
      periods: [period("2026-09-01", 5)],
      days: days(day("2026-09-02", { symptoms: ["cramps", "back_pain"], flow: "heavy" }), day("2026-09-03", {})),
    });
    const rows = csv.split("\n");
    expect(rows[0]).toBe("type,date,end,flow,symptoms,mood,energy,ovulation_test");
    expect(rows[1]).toBe("period,2026-09-01,2026-09-05,,,,,");
    expect(rows[2]).toBe("day,2026-09-02,,Heavy,Cramps; Back pain,,,");
    expect(rows).toHaveLength(3); // the cleared day is not exported
  });
});
