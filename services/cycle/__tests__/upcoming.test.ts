/**
 * "YOUR PERIOD MEETS YOUR CALENDAR" — a predicted period crossed with her trips.
 *
 * What a test can hold, and what would quietly rot without one:
 *   · the words follow the window: "will probably" only when the most likely day
 *     is inside the event, "might" when only the window's edge touches it;
 *   · a second sentence about a race only when HER patterns say something about
 *     that exact day of her period;
 *   · calendar entries count only under calendar consent, inferred ones never;
 *   · nothing in the logging-only or paused modes, or once she's late;
 *   · the phone reminder never names the period, and the headless path that
 *     lays it stays lean — no ./care, no food database.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCycleBrief, cycleStateLines } from "../brief";
import { addDays } from "../dates";
import { predict, todayStatus } from "../predict";
import { CYCLE_REMINDER_ID, planCycleReminders } from "../reminderPlan";
import type { CycleDays, CycleSettings } from "../types";
import {
  momentsFrom,
  nextTripOverlap,
  trainingNote,
  UPCOMING_HEADS_UP_DAYS,
  UPCOMING_HORIZON_DAYS,
  type ComingUp,
  type LifeEventLike,
  type LifeMoment,
  type MomentKind,
} from "../upcoming";
import { computeView } from "../view";
import { day, days, history, settings } from "./helpers";

const TODAY = "2026-10-01";
/** Last start 23 Sep, 28-day cycles: most likely 21 Oct, window 19–23 Oct; the one after 18 Nov, 15–21 Nov. */
const PERIODS = history("2026-04-08", [28, 28, 28, 28, 28, 28]);
const S = settings({ usualCycleDays: 28 });

const moment = (kind: MomentKind, title: string, start: string, end = start): LifeMoment => ({
  id: `${kind}:${title}`,
  kind,
  title,
  start,
  end,
});

function viewOf(
  moments: LifeMoment[],
  opts: { today?: string; set?: CycleSettings; conditions?: string[]; logged?: CycleDays } = {},
) {
  return computeView(
    { settings: opts.set ?? S, periods: PERIODS, days: opts.logged ?? {} },
    { today: opts.today ?? TODAY, profile: { age: 30, conditions: opts.conditions ?? [] }, moments },
  );
}
const first = (moments: LifeMoment[], opts?: Parameters<typeof viewOf>[1]): ComingUp | undefined =>
  viewOf(moments, opts).comingUp[0];

describe("the words follow the window", () => {
  it("says 'will probably' when the most likely day is inside the trip", () => {
    const u = first([moment("travel", "Lagos trip", "2026-10-19", "2026-10-24")])!;
    expect(u.certainty).toBe("probable");
    expect(u.text).toBe("Your next period will probably start during your Lagos trip (19–24 Oct). Worth packing for.");
  });

  it("says 'might' when only the edge of the window touches it", () => {
    const u = first([moment("travel", "Lagos trip", "2026-10-22", "2026-10-26")])!;
    expect(u.certainty).toBe("possible");
    expect(u.text).toBe("Your next period might start during your Lagos trip (22–26 Oct). Worth packing for.");
  });

  it("says nothing when the window doesn't reach it", () => {
    expect(first([moment("travel", "Lagos trip", "2026-10-24", "2026-10-28")])).toBeUndefined();
    expect(first([moment("travel", "Lagos trip", "2026-10-05", "2026-10-10")])).toBeUndefined();
  });

  it("reaches the period after next, more widely, and names which one it means", () => {
    const u = first([moment("travel", "Abuja", "2026-11-17", "2026-11-20")])!;
    expect(u.text).toBe("Your period after next will probably start during your Abuja (17–20 Nov). Worth packing for.");
    expect(u.detail).toBe("Predicted 15–21 Nov · Fairly sure");
    // 15 Nov is outside the next period's ±2 reach applied to the second date, inside √2 of it.
    expect(first([moment("travel", "Abuja", "2026-11-13", "2026-11-15")])?.certainty).toBe("possible");
  });

  it("always shows the window and the confidence word it came from", () => {
    expect(first([moment("travel", "Lagos trip", "2026-10-19", "2026-10-24")])!.detail).toBe(
      "Predicted 19–23 Oct · Fairly sure",
    );
    const early = computeView(
      { settings: S, periods: [PERIODS[6]], days: {} },
      { today: TODAY, profile: { age: 30, conditions: [] }, moments: [moment("travel", "Trip", "2026-10-21", "2026-10-22")] },
    );
    expect(early.comingUp[0].detail).toContain("Still learning");
  });

  it("closes with what fits the event", () => {
    expect(first([moment("wedding", "Wedding", "2026-10-19")])!.text).toBe(
      "Your next period might start around your Wedding (19 Oct). Worth having what you need with you.",
    );
    expect(first([moment("exam_period", "Finals", "2026-10-18", "2026-10-25")])!.text).toContain(
      "will probably start during your Finals (18–25 Oct). Worth having what you need with you.",
    );
  });

  it("lists soonest first, each event once", () => {
    const v = viewOf([
      moment("travel", "Lagos", "2026-10-19", "2026-11-20"),
      moment("competition", "10K", "2026-10-22"),
    ]);
    expect(v.comingUp.map((u) => u.title)).toEqual(["Lagos", "10K"]);
  });
});

describe("a race, or any one-day event", () => {
  /** Flow logged on three completed cycles, heaviest on day 2 of each. */
  const flows = (): CycleDays => {
    const out: CycleDays = {};
    for (const start of ["2026-07-01", "2026-07-29", "2026-08-26"]) {
      out[start] = day(start, { flow: "medium" });
      out[addDays(start, 1)] = day(addDays(start, 1), { flow: "heavy" });
      out[addDays(start, 2)] = day(addDays(start, 2), { flow: "light" });
    }
    return out;
  };

  it("says 'your last N periods' only when she logged flow in every one of them", () => {
    const all: CycleDays = {};
    for (const start of ["2026-04-08", "2026-05-06", "2026-06-03", "2026-07-01", "2026-07-29", "2026-08-26"]) {
      all[start] = day(start, { flow: "medium" });
      all[addDays(start, 1)] = day(addDays(start, 1), { flow: "heavy" });
    }
    expect(first([moment("competition", "10K", "2026-10-22")], { logged: all })!.text).toContain(
      "On your last 6 periods, day 2 was your heaviest day.",
    );
  });

  it("names the likely day of her period", () => {
    expect(first([moment("competition", "10K", "2026-10-22")])!.text).toBe(
      "Your 10K is on 22 Oct, likely day 2 of your period.",
    );
  });

  it("adds her heaviest day only when it IS that day", () => {
    expect(first([moment("competition", "10K", "2026-10-22")], { logged: flows() })!.text).toBe(
      // Six recent cycles, flow logged in three: the denominator names the three.
      "Your 10K is on 22 Oct, likely day 2 of your period. On the 3 recent periods you logged flow in, day 2 was your heaviest day.",
    );
    expect(first([moment("competition", "10K", "2026-10-21")], { logged: flows() })!.text).toBe(
      "Your 10K is on 21 Oct, likely day 1 of your period.",
    );
  });

  it("adds her cramps when they fall on that day and her flow says nothing", () => {
    const logged = days(
      ...["2026-07-01", "2026-07-29", "2026-08-26"].map((d) => day(d, { symptoms: ["cramps"] })),
    );
    expect(first([moment("competition", "10K", "2026-10-21")], { logged })!.text).toBe(
      "Your 10K is on 21 Oct, likely day 1 of your period. You've logged cramps on day 1 of your period in 3 of the 3 recent cycles you logged in.",
    );
  });

  it("says 'might start around' when it falls in the window before the likely day", () => {
    expect(first([moment("competition", "10K", "2026-10-20")])!.text).toBe(
      "Your next period might start around your 10K (20 Oct).",
    );
  });

  it("adds what her training pattern says, about a race only", () => {
    const race = first([moment("competition", "10K", "2026-10-22")])!;
    const keeps = [{ kind: "training", trainingHabit: "keeps" }] as never[];
    const eases = [{ kind: "training", trainingHabit: "eases" }] as never[];
    expect(trainingNote(race, keeps)).toBe("You usually keep training through it.");
    expect(trainingNote(race, eases)).toBe("You usually train less in those first days.");
    expect(trainingNote(race, [])).toBeNull();
    // "Eases" measured the first three days and speaks only for them.
    expect(trainingNote(first([moment("competition", "10K", "2026-10-25")])!, eases)).toBeNull();
    expect(trainingNote(first([moment("wedding", "Wedding", "2026-10-22")])!, keeps)).toBeNull();
  });
});

describe("when it stays quiet", () => {
  const trip = [moment("travel", "Lagos trip", "2026-10-19", "2026-10-24")];

  it("has nothing to say in the logging-only and paused modes", () => {
    const onMethod = settings({
      usualCycleDays: 28,
      contraception: { answer: "hormonal", since: "2026-01-01", restartFrom: null },
    });
    expect(viewOf(trip, { set: onMethod }).comingUp).toEqual([]);
    expect(viewOf(trip, { conditions: ["pregnancy"] }).comingUp).toEqual([]);
    expect(viewOf(trip, { conditions: ["menopause"] }).comingUp).toEqual([]);
  });

  it("speaks after a birth, once predictions have restarted", () => {
    const after = settings({ usualCycleDays: 28, postpartumSince: "2026-01-01" });
    expect(viewOf(trip, { set: after, conditions: ["postpartum"] }).comingUp).toHaveLength(1);
  });

  it("is silent once she's late — that window has passed", () => {
    const v = viewOf([moment("travel", "Lagos", "2026-11-17", "2026-11-20")], { today: "2026-10-28" });
    expect(v.status.lateBy).toBeGreaterThan(0);
    expect(v.comingUp).toEqual([]);
  });
});

describe("what it reads", () => {
  const entry = (patch: Partial<LifeEventLike>): LifeEventLike => ({
    id: "e1",
    kind: "travel",
    title: "Lagos trip",
    window: { start: "2026-10-19", end: "2026-10-24" },
    source: "user",
    status: "active",
    ...patch,
  });
  const read = (patch: Partial<LifeEventLike>, calendarAllowed = false) =>
    momentsFrom([entry(patch)], { calendarAllowed, today: TODAY });

  it("takes what she entered, in its own words", () => {
    expect(read({})).toEqual([
      { id: "e1", kind: "travel", title: "Lagos trip", start: "2026-10-19", end: "2026-10-24" },
    ]);
  });

  it("takes a calendar entry only while calendar consent stands, and an inferred one never", () => {
    expect(read({ source: "calendar" })).toEqual([]);
    expect(read({ source: "calendar" }, true)).toHaveLength(1);
    expect(read({ source: "inferred" }, true)).toEqual([]);
  });

  it("takes only the kinds of event a period matters to, and only active ones", () => {
    expect(read({ kind: "deadline" })).toEqual([]);
    expect(read({ kind: "surgery" })).toEqual([]);
    expect(read({ status: "dismissed" })).toEqual([]);
    expect(read({ status: "completed" })).toEqual([]);
    for (const kind of ["vacation", "holiday", "wedding", "competition", "exam_period"]) {
      expect(read({ kind })).toHaveLength(1);
    }
  });

  it(`looks ${UPCOMING_HORIZON_DAYS} days ahead, and never at what is over`, () => {
    expect(read({ window: { start: addDays(TODAY, UPCOMING_HORIZON_DAYS) } })).toHaveLength(1);
    expect(read({ window: { start: addDays(TODAY, UPCOMING_HORIZON_DAYS + 1) } })).toEqual([]);
    expect(read({ window: { start: "2026-09-20", end: "2026-09-30" } })).toEqual([]);
    // Still under way counts.
    expect(read({ window: { start: "2026-09-20", end: TODAY } })).toHaveLength(1);
  });

  it("treats no end as one day, and drops what it can't trust", () => {
    expect(read({ window: { start: "2026-10-19" } })[0].end).toBe("2026-10-19");
    expect(read({ window: { start: "2026-10-19", end: "2026-10-01" } })[0].end).toBe("2026-10-19");
    expect(read({ window: { start: "soon" } })).toEqual([]);
    expect(read({ window: null })).toEqual([]);
    expect(read({ title: "  " })).toEqual([]);
  });
});

describe("the heads-up, a few days out", () => {
  const trip = [moment("travel", "Lagos trip", "2026-10-19", "2026-10-24")];

  it(`joins today's heads-ups ${UPCOMING_HEADS_UP_DAYS} days before it starts, and not sooner`, () => {
    expect(viewOf(trip, { today: "2026-10-15" }).headsUps).toEqual([]);
    const v = viewOf(trip, { today: "2026-10-16" });
    expect(v.headsUps[0]).toMatchObject({
      id: "upcoming:travel:Lagos trip",
      text: "Your next period will probably start during your Lagos trip (19–24 Oct). Worth packing for.",
    });
  });

  it("keeps the same two-line limit when patterns have something to say too", () => {
    const logged = days(
      ...["2026-07-01", "2026-07-29", "2026-08-26"].flatMap((s) => [
        day(addDays(s, 26), { symptoms: ["headache", "bloating", "acne"] }),
      ]),
    );
    expect(viewOf(trip, { today: "2026-10-19", logged }).headsUps.length).toBeLessThanOrEqual(2);
  });
});

describe("the one phone reminder", () => {
  const plan = (moments: LifeMoment[], patch: Partial<CycleSettings> = {}, now = new Date(2026, 9, 1, 8)) => {
    const set = settings({ usualCycleDays: 28, ...patch });
    const today = `2026-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const input = { episodes: PERIODS, days: {}, settings: set, today, profile: { age: 30, conditions: [] } };
    const prediction = predict(input);
    return planCycleReminders({ settings: set, status: todayStatus(input, prediction), prediction, now, moments });
  };
  const tripAt = (start: string, end: string, kind: MomentKind = "travel") => moment(kind, "Lagos trip", start, end);

  it("fires at 09:00 two days before the trip", () => {
    const r = plan([tripAt("2026-10-21", "2026-10-25")]).find((x) => x.kind === "trip")!;
    expect(r.id).toBe(CYCLE_REMINDER_ID("trip"));
    expect(r.at).toEqual(new Date(2026, 9, 19, 9));
  });

  it("never names the period, with discreet wording on or off", () => {
    for (const discreet of [true, false]) {
      const r = plan([tripAt("2026-10-21", "2026-10-25")], { discreet }).find((x) => x.kind === "trip")!;
      expect(`${r.title} ${r.body}`).not.toMatch(/period|bleed|cycle|lagos/i);
      expect(r.title).toBe("A heads-up for your trip");
    }
  });

  it("is for trips only: a race or a wedding stays inside the app", () => {
    expect(plan([moment("competition", "10K", "2026-10-22")]).some((x) => x.kind === "trip")).toBe(false);
    expect(plan([moment("wedding", "Wedding", "2026-10-22")]).some((x) => x.kind === "trip")).toBe(false);
    expect(plan([tripAt("2026-10-21", "2026-10-25", "vacation")]).some((x) => x.kind === "trip")).toBe(true);
  });

  it("is only ever about the soonest trip a period actually meets", () => {
    expect(plan([tripAt("2026-10-05", "2026-10-08")]).some((x) => x.kind === "trip")).toBe(false);
    const set = settings({ usualCycleDays: 28 });
    const input = { episodes: PERIODS, days: {}, settings: set, today: TODAY, profile: {} };
    const prediction = predict(input);
    const both = [tripAt("2026-10-05", "2026-10-08"), moment("travel", "Abuja", "2026-10-20", "2026-10-22")];
    expect(nextTripOverlap({ prediction, status: todayStatus(input, prediction), moments: both })?.title).toBe("Abuja");
  });

  it("needs reminders on, and never fires late", () => {
    expect(plan([tripAt("2026-10-21", "2026-10-25")], { remindersOn: false })).toEqual([]);
    const tooLate = plan([tripAt("2026-10-21", "2026-10-25")], {}, new Date(2026, 9, 19, 10));
    expect(tooLate.some((x) => x.kind === "trip")).toBe(false);
  });

  it("replaces a heads-up due the same morning, and never exceeds three pending", () => {
    // The window opens 19 Oct, so the heads-up is due the 17th: a trip starting the 19th shares its morning.
    const shared = plan([tripAt("2026-10-19", "2026-10-24")]);
    expect(shared.map((x) => x.kind).sort()).toEqual(["checkin", "trip"]);
    const apart = plan([tripAt("2026-10-21", "2026-10-25")]);
    expect(apart.map((x) => x.kind).sort()).toEqual(["checkin", "headsup", "trip"]);
    expect(apart.length).toBeLessThanOrEqual(3);
  });

  it("stays silent on hormonal contraception and in pregnancy", () => {
    const hormonal = { contraception: { answer: "hormonal" as const, since: "2026-01-01", restartFrom: null } };
    expect(plan([tripAt("2026-10-21", "2026-10-25")], hormonal)).toEqual([]);
  });
});

describe("the coach", () => {
  it("hears the two soonest, as estimates, in words about her", () => {
    const v = viewOf([
      moment("travel", "Lagos trip", "2026-10-19", "2026-10-24"),
      moment("competition", "10K", "2026-10-22"),
      moment("travel", "Abuja", "2026-11-17", "2026-11-20"),
    ]);
    const lines = cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, showFertileWindow: false, comingUp: v.comingUp }),
    );
    expect(lines).toContain(
      "- coming up: her next period will probably start during her Lagos trip (19–24 Oct; an estimate); her 10K on 22 Oct is likely day 2 of her period (an estimate)",
    );
    expect(lines.join(" ")).not.toContain("Abuja");
  });
});

describe("the reminder path stays lean", () => {
  /**
   * Everything services/cycle/reminders.ts really loads at runtime. It runs in
   * Android's headless task, where a heavy import graph costs every lock-screen
   * press: `import type` is erased, so it doesn't count.
   */
  function runtimeGraph(entry: string): Set<string> {
    const root = process.cwd();
    const seen = new Set<string>();
    const walk = (file: string) => {
      const rel = relative(root, file).split("\\").join("/");
      if (seen.has(rel)) return;
      seen.add(rel);
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)) {
        if (m[1]) continue;
        const spec = m[2];
        const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
        if (!base) continue;
        const hit = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p));
        if (hit) walk(hit);
      }
    };
    walk(join(root, entry));
    return seen;
  }

  it("never reaches the food database, or the view that would drag it in", () => {
    const graph = runtimeGraph("services/cycle/reminders.ts");
    expect(graph.has("services/cycle/upcoming.ts")).toBe(true);
    expect(graph.has("services/cycle/lifeMoments.ts")).toBe(true);
    expect(graph.has("services/cycle/care.ts")).toBe(false);
    expect(graph.has("services/cycle/view.ts")).toBe(false);
    expect(graph.has("constants/NutrientDatabase.ts")).toBe(false);
    // Reading Life Context must not pull the whole health-os in either.
    expect(graph.has("health-os/index.ts")).toBe(false);
  });
});
