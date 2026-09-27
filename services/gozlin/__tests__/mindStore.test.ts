import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCheckin,
  getCheckinsOn,
  getTodayCheckin,
  removeCheckin,
} from "../GozlinMemoryStore";
import { mindEntryId, toMindEntry } from "../MindService";
import type { GozlinCheckin } from "../gozlin.types";

const KEY = "@gozlin_checkins";

beforeEach(async () => {
  await AsyncStorage.removeItem(KEY);
});

function daily(date: string, valence: number, createdAt = 1): GozlinCheckin {
  return { id: `daily:${date}`, date, kind: "daily", valence, createdAt };
}

function moment(date: string, valence: number, createdAt: number): GozlinCheckin {
  return {
    id: `moment:${date}:${createdAt}`,
    date,
    kind: "momentary",
    valence,
    createdAt,
  };
}

describe("the check-in tier is no longer one per day", () => {
  it("keeps several momentary entries on the same date", async () => {
    await addCheckin(moment("2026-09-24", -0.5, 1));
    await addCheckin(moment("2026-09-24", 0, 2));
    const list = await addCheckin(moment("2026-09-24", 1, 3));

    expect(list).toHaveLength(3);
    // A rough morning and a decent evening are two facts, not one overwritten.
    expect(list.map((c) => c.valence)).toEqual([-0.5, 0, 1]);
  });

  it("orders entries within a day by when they were felt", async () => {
    await addCheckin(moment("2026-09-24", 1, 30));
    await addCheckin(moment("2026-09-24", -1, 10));
    const list = await addCheckin(moment("2026-09-24", 0, 20));

    expect(list.map((c) => c.createdAt)).toEqual([10, 20, 30]);
  });

  it("replaces the day's daily entry rather than adding a second", async () => {
    await addCheckin(daily("2026-09-24", -1));
    const list = await addCheckin(daily("2026-09-24", 1));

    expect(list).toHaveLength(1);
    expect(list[0].valence).toBe(1);
  });

  it("does NOT wipe the day's moments when the daily entry is saved", async () => {
    // The old implementation filtered by date, so writing the day's check-in
    // silently destroyed everything else recorded that day.
    await addCheckin(moment("2026-09-24", -1, 1));
    await addCheckin(moment("2026-09-24", 0, 2));
    const list = await addCheckin(daily("2026-09-24", 1, 3));

    expect(list).toHaveLength(3);
    expect(list.filter((c) => c.kind === "momentary")).toHaveLength(2);
  });

  it("updates a momentary entry in place when the same id is saved again", async () => {
    const m = moment("2026-09-24", -1, 5);
    await addCheckin(m);
    const list = await addCheckin({ ...m, valence: 0.5 });

    expect(list).toHaveLength(1);
    expect(list[0].valence).toBe(0.5);
  });

  it("treats a pre-004 record with no id or kind as the day's daily entry", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify([{ date: "2026-09-24", mood: 4, createdAt: 1 }]),
    );
    const list = await addCheckin(daily("2026-09-24", 1, 2));

    // It had no id, but it was a day's check-in, so the new daily entry replaces
    // it rather than sitting alongside a duplicate.
    expect(list).toHaveLength(1);
    expect(list[0].valence).toBe(1);
  });
});

describe("reading a day back", () => {
  it("getTodayCheckin returns the daily entry, ignoring moments", async () => {
    await addCheckin(moment("2026-09-24", -1, 1));
    await addCheckin(daily("2026-09-24", 0.5, 2));
    await addCheckin(moment("2026-09-24", 1, 3));

    const today = await getTodayCheckin("2026-09-24");
    expect(today?.kind).toBe("daily");
    expect(today?.valence).toBe(0.5);
  });

  it("getTodayCheckin is null when only moments exist", async () => {
    await addCheckin(moment("2026-09-24", 1, 1));
    expect(await getTodayCheckin("2026-09-24")).toBeNull();
  });

  it("getCheckinsOn returns every entry for the date", async () => {
    await addCheckin(moment("2026-09-24", 1, 1));
    await addCheckin(daily("2026-09-24", 0, 2));
    await addCheckin(daily("2026-09-23", -1, 3));

    expect(await getCheckinsOn("2026-09-24")).toHaveLength(2);
  });
});

describe("removing an entry", () => {
  it("removes exactly one entry by id", async () => {
    await addCheckin(moment("2026-09-24", 1, 1));
    await addCheckin(moment("2026-09-24", -1, 2));
    const list = await removeCheckin("moment:2026-09-24:1");

    expect(list).toHaveLength(1);
    expect(list[0].createdAt).toBe(2);
  });

  it("leaves the list alone when the id is unknown", async () => {
    await addCheckin(daily("2026-09-24", 1));
    expect(await removeCheckin("nope")).toHaveLength(1);
  });
});

describe("entry identity", () => {
  it("gives a daily entry an id derived from its date, so it is stable", async () => {
    expect(mindEntryId("2026-09-24", "daily")).toBe("daily:2026-09-24");
    expect(mindEntryId("2026-09-24", "daily")).toBe(mindEntryId("2026-09-24", "daily"));
  });

  it("gives each momentary entry a distinct id", () => {
    const a = mindEntryId("2026-09-24", "momentary");
    const b = mindEntryId("2026-09-24", "momentary");
    expect(a).not.toBe(b);
  });
});

describe("toMindEntry", () => {
  it("clamps the valence it stores", () => {
    expect(toMindEntry({ date: "2026-09-24", kind: "daily", valence: 5 }).valence).toBe(1);
  });

  it("drops empty label and association lists rather than storing []", () => {
    const e = toMindEntry({
      date: "2026-09-24",
      kind: "daily",
      valence: 0,
      labels: [],
      associations: [],
    });
    expect(e.labels).toBeUndefined();
    expect(e.associations).toBeUndefined();
  });

  it("refuses to attach sleep to a momentary entry", () => {
    // Sleep belongs to the night behind a whole day; a moment carrying one would
    // be claiming a fact about a different span of time.
    const e = toMindEntry({
      date: "2026-09-24",
      kind: "momentary",
      valence: 0,
      sleepHours: 7,
    });
    expect(e.sleepHours).toBeUndefined();
  });

  it("keeps sleep on a daily entry", () => {
    const e = toMindEntry({
      date: "2026-09-24",
      kind: "daily",
      valence: 0,
      sleepHours: 7,
    });
    expect(e.sleepHours).toBe(7);
  });

  it("reuses a supplied id so an edit updates in place", () => {
    const e = toMindEntry({
      date: "2026-09-24",
      kind: "momentary",
      valence: 0,
      id: "moment:fixed",
    });
    expect(e.id).toBe("moment:fixed");
  });

  it("prunes falsy labels rather than storing blanks", () => {
    const e = toMindEntry({
      date: "2026-09-24",
      kind: "daily",
      valence: 0,
      labels: ["Calm", "", "Proud"],
    });
    expect(e.labels).toEqual(["Calm", "Proud"]);
  });
});
