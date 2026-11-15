/**
 * Gozlin acting for them (G2): log water, log weight, log a workout, add a
 * habit, set a reminder.
 *
 * Every write shows exactly what will change, waits for the tap, then writes
 * through the app's own store. A "no" writes nothing. And there is no tool at
 * all for the things the coach must never do: change calorie or protein
 * targets, delete anything, or write to the period tracker.
 */
import { describe, expect, it, vi } from "vitest";
import { TOOL_SCHEMAS, findTool, type GozlinToolActions, type GozlinToolContext, type ToolConfirmRequest } from "../tools";

const NOW = new Date(2026, 10, 14, 15, 0); // Sat 14 Nov 2026, 15:00 local

function harness(answer: boolean, over: Partial<GozlinToolActions> = {}) {
  const asked: ToolConfirmRequest[] = [];
  const actions: GozlinToolActions = {
    confirm: vi.fn(async (r: ToolConfirmRequest) => {
      asked.push(r);
      return answer;
    }),
    waterStatus: vi.fn(async () => ({ todayMl: 2300, goalMl: 2500 })),
    logWater: vi.fn(async (ml: number) => ({ ok: true as const, todayMl: 2300 + ml, goalMl: 2500 })),
    weightStatus: vi.fn(async () => ({
      show: (kg: number) => `${kg.toFixed(1)} kg`,
      last: { kg: 82.4, date: "2026-11-10" },
      todayKg: null,
    })),
    logWeight: vi.fn(async () => ({ ok: true as const })),
    logWorkout: vi.fn(async () => ({ ok: true as const })),
    habitNames: () => ["Read before bed"],
    addHabit: vi.fn(async () => ({ ok: true as const })),
    reminderBlock: vi.fn(async () => null),
    setReminder: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
  const ctx = { now: NOW, actions } as unknown as GozlinToolContext;
  const run = (name: string, input: unknown) => findTool(name)!.run(input, ctx);
  return { actions, asked, run };
}

describe("log_water", () => {
  it("shows today's water before and after, then writes on yes", async () => {
    const h = harness(true);
    const out = await h.run("log_water", { ml: 250 });
    expect(h.asked[0].summary).toBe("Log 250 ml of water?");
    expect(h.asked[0].detail).toContain("Today: 2300 → 2550 ml of 2500 ml");
    expect(h.asked[0].detail).toContain("That meets your whole water goal, which keeps today.");
    expect(h.actions.logWater).toHaveBeenCalledWith(250);
    expect(out).toMatchObject({ status: "logged", goalMet: true });
  });

  it("never says a glass keeps the day when it doesn't meet the whole goal", async () => {
    const h = harness(true, { waterStatus: vi.fn(async () => ({ todayMl: 500, goalMl: 2500 })) });
    await h.run("log_water", { ml: 250 });
    expect(h.asked[0].detail).not.toMatch(/keeps today/);
  });

  it("writes nothing on no", async () => {
    const h = harness(false);
    expect(await h.run("log_water", { ml: 250 })).toMatchObject({ status: "declined" });
    expect(h.actions.logWater).not.toHaveBeenCalled();
  });

  it("refuses a misread amount without asking", async () => {
    const h = harness(true);
    expect(await h.run("log_water", { ml: 20000 })).toMatchObject({ status: "rejected" });
    expect(h.asked).toHaveLength(0);
  });
});

describe("log_weight", () => {
  it("shows the last weigh-in in their unit, then writes", async () => {
    const h = harness(true);
    await h.run("log_weight", { kg: 81.94 });
    expect(h.asked[0].summary).toBe("Log 81.9 kg as today's weight?");
    expect(h.asked[0].detail).toBe("Your last weigh-in: 82.4 kg on 10 Nov");
    expect(h.actions.logWeight).toHaveBeenCalledWith(81.9);
  });

  it("says when it replaces today's reading", async () => {
    const h = harness(true, {
      weightStatus: vi.fn(async () => ({ show: (kg: number) => `${kg} kg`, last: null, todayKg: 82 })),
    });
    await h.run("log_weight", { kg: 81.5 });
    expect(h.asked[0].detail).toContain("This replaces today's 82 kg.");
  });

  it("writes nothing on no, and refuses an impossible reading", async () => {
    const h = harness(false);
    await h.run("log_weight", { kg: 80 });
    expect(h.actions.logWeight).not.toHaveBeenCalled();
    expect(await harness(true).run("log_weight", { kg: 900 })).toMatchObject({ status: "rejected" });
  });
});

describe("log_workout", () => {
  it("names what will be logged, and that it keeps the day", async () => {
    const h = harness(true);
    await h.run("log_workout", { activity: "  yoga   class ", minutes: 45.4 });
    expect(h.asked[0].summary).toBe("Log yoga class, 45 min, as today's workout?");
    expect(h.asked[0].detail).toBe("It counts as a workout today, which keeps your day.");
    expect(h.actions.logWorkout).toHaveBeenCalledWith({ activity: "yoga class", minutes: 45 });
  });

  it("writes nothing on no, and asks instead of guessing a duration", async () => {
    const h = harness(false);
    await h.run("log_workout", { activity: "run", minutes: 30 });
    expect(h.actions.logWorkout).not.toHaveBeenCalled();
    expect(await harness(true).run("log_workout", { activity: "run", minutes: 0 })).toMatchObject({ status: "rejected" });
  });
});

describe("add_habit", () => {
  it("adds with the schedule they asked for", async () => {
    const h = harness(true);
    await h.run("add_habit", { name: "Stretch after waking", schedule: "weekdays" });
    expect(h.asked[0].summary).toBe('Add the habit "Stretch after waking", on weekdays?');
    expect(h.actions.addHabit).toHaveBeenCalledWith({ name: "Stretch after waking", schedule: "weekdays" });
  });

  it("refuses a habit they already track, without asking", async () => {
    const h = harness(true);
    expect(await h.run("add_habit", { name: "read before bed", schedule: "every_day" })).toMatchObject({ status: "exists" });
    expect(h.asked).toHaveLength(0);
  });

  it("writes nothing on no", async () => {
    const h = harness(false);
    await h.run("add_habit", { name: "Floss", schedule: "every_day" });
    expect(h.actions.addHabit).not.toHaveBeenCalled();
  });
});

describe("set_reminder", () => {
  it("sets one reminder at the local time they gave", async () => {
    const h = harness(true);
    await h.run("set_reminder", { text: "Prep lunch", time: "7:30", day: "tomorrow" });
    expect(h.asked[0].summary).toBe('Remind you tomorrow at 7:30: "Prep lunch"?');
    const call = (h.actions.setReminder as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.text).toBe("Prep lunch");
    expect(call.at.getDate()).toBe(15);
    expect(call.at.getHours()).toBe(7);
    expect(call.at.getMinutes()).toBe(30);
  });

  it("refuses a time that has passed today", async () => {
    const h = harness(true);
    expect(await h.run("set_reminder", { text: "Walk", time: "09:00", day: "today" })).toMatchObject({ status: "rejected" });
    expect(h.asked).toHaveLength(0);
  });

  it("says plainly when reminders can't be set (Pause all, a quiet day) — before asking", async () => {
    const h = harness(true, { reminderBlock: vi.fn(async () => "Your reminders are paused (Pause all, in Settings).") });
    expect(await h.run("set_reminder", { text: "Walk", time: "18:00", day: "today" })).toEqual({
      status: "unavailable",
      reason: "Your reminders are paused (Pause all, in Settings).",
    });
    expect(h.asked).toHaveLength(0);
    expect(h.actions.setReminder).not.toHaveBeenCalled();
  });

  it("writes nothing on no", async () => {
    const h = harness(false);
    await h.run("set_reminder", { text: "Walk", time: "18:00", day: "today" });
    expect(h.actions.setReminder).not.toHaveBeenCalled();
  });
});

describe("fail closed", () => {
  it("every write is unavailable without a confirmation gate", async () => {
    const h = harness(true, { confirm: undefined });
    for (const [name, input] of [
      ["log_water", { ml: 250 }],
      ["log_weight", { kg: 80 }],
      ["log_workout", { activity: "run", minutes: 30 }],
      ["add_habit", { name: "Floss", schedule: "every_day" }],
      ["set_reminder", { text: "Walk", time: "18:00", day: "today" }],
    ] as const) {
      expect(await h.run(name, input)).toMatchObject({ status: "unavailable" });
    }
  });
});

describe("what the coach can never do", () => {
  const names = TOOL_SCHEMAS.map((t) => t.name);

  it("has no tool to change targets, delete anything, or touch the cycle", () => {
    for (const n of names) expect(n).not.toMatch(/target|delete|remove|erase|cycle|period|calorie|protein/);
  });

  it("offers the new writes, sorted, each strict", () => {
    for (const n of ["log_water", "log_weight", "log_workout", "add_habit", "set_reminder"]) expect(names).toContain(n);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(TOOL_SCHEMAS.every((t) => t.strict === true)).toBe(true);
  });
});
