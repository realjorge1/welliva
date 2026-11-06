/**
 * "Your usual?" — what counts as a usual, who it is for, what it logs, and the
 * forget that holds. Dates are built from local parts, never toISOString().
 */
import { describe, expect, it } from "vitest";

import type { ResolvedFoodItem } from "../../../models/nutrients";
import type { FoodLogEntry, LogStore } from "../../nutrition/foodLogStore";
import type { IntakeLedger } from "../../nutrition/IntakeLedger";
import {
  containsAll,
  findUsuals,
  fingerprintOf,
  isUsualSnapshot,
  itemKey,
  snapshotOf,
  usualMessage,
  usualReminderBody,
  usualSource,
} from "../usual";

const TODAY = "2026-11-21";
const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD `n` days before TODAY, from local parts. */
function ago(n: number): string {
  const d = new Date(2026, 10, 21);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function item(foodId: string | null, grams: number, calories: number, extra: Partial<ResolvedFoodItem> = {}): ResolvedFoodItem {
  return {
    id: `i-${foodId}-${grams}`,
    inputText: foodId ?? "mystery",
    name: foodId ?? "mystery",
    foodId,
    quantity: grams,
    unit: "g",
    grams,
    nutrients: { calories } as ResolvedFoodItem["nutrients"],
    source: null,
    confidence: "verified" as ResolvedFoodItem["confidence"],
    matchScore: 1,
    ...extra,
  };
}

let seq = 0;
function entry(date: string, slot: FoodLogEntry["slot"], label: string, items: ResolvedFoodItem[], hh = 8, mm = 10): FoodLogEntry {
  const at = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hh, mm);
  const calories = items.reduce((s, i) => s + (i.nutrients.calories ?? 0), 0);
  return {
    id: `e${++seq}`,
    date,
    slot,
    label,
    items,
    totals: { calories } as FoodLogEntry["totals"],
    partialKeys: [],
    confidence: "verified" as FoodLogEntry["confidence"],
    origin: "catalog",
    loggedAt: at.toISOString(),
  };
}

/** Oats with milk + coffee, the classic usual. */
function breakfast(date: string, hh = 8, mm = 10): FoodLogEntry[] {
  return [
    entry(date, "breakfast", "Oats with milk", [item("oats", 50, 190), item("milk", 200, 130)], hh, mm),
    entry(date, "breakfast", "coffee", [item("coffee", 240, 100)], hh, mm + 1),
  ];
}

function log(days: Record<string, FoodLogEntry[]>): LogStore {
  return days;
}

describe("the fingerprint", () => {
  it("ignores order and wording, but not the amount", () => {
    const a = breakfast(ago(1));
    const b = [...breakfast(ago(2))].reverse().map((e) => ({ ...e, label: e.label.toUpperCase() }));
    expect(fingerprintOf(a)).toBe(fingerprintOf(b));
    const more = [entry(ago(3), "breakfast", "Oats with milk", [item("oats", 80, 300), item("milk", 200, 130)]), breakfast(ago(3))[1]];
    expect(fingerprintOf(more)).not.toBe(fingerprintOf(a));
  });

  it("names an unmatched item by what was typed", () => {
    expect(itemKey(item(null, 0, 0, { inputText: " Grandma's  stew ", quantity: 1, unit: "Bowl" }))).toBe("t:grandma's stew@1bowl");
  });
});

describe("findUsuals — the definition", () => {
  it("finds a meal eaten the same way on 3 of the last 14 days", () => {
    const store = log({ [ago(1)]: breakfast(ago(1)), [ago(4)]: breakfast(ago(4)), [ago(9)]: breakfast(ago(9)) });
    const [u] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY });
    expect(u.slot).toBe("breakfast");
    expect(u.days).toBe(3);
    expect(u.lastDate).toBe(ago(1));
    expect(u.calories).toBe(420);
  });

  it("needs three days, not two", () => {
    const store = log({ [ago(1)]: breakfast(ago(1)), [ago(4)]: breakfast(ago(4)) });
    expect(findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY })).toEqual([]);
  });

  it("needs one of them this week", () => {
    const store = log({ [ago(8)]: breakfast(ago(8)), [ago(10)]: breakfast(ago(10)), [ago(12)]: breakfast(ago(12)) });
    expect(findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY })).toEqual([]);
  });

  it("ignores days outside the fortnight", () => {
    const store = log({ [ago(1)]: breakfast(ago(1)), [ago(14)]: breakfast(ago(14)), [ago(20)]: breakfast(ago(20)) });
    expect(findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY })).toEqual([]);
  });

  it("picks the more frequent of two, and the more recent on a tie", () => {
    const eggs = (d: string) => [entry(d, "breakfast", "Two eggs", [item("egg", 100, 155)])];
    const store = log({
      [ago(1)]: eggs(ago(1)),
      [ago(2)]: breakfast(ago(2)),
      [ago(3)]: eggs(ago(3)),
      [ago(4)]: breakfast(ago(4)),
      [ago(5)]: eggs(ago(5)),
      [ago(6)]: breakfast(ago(6)),
    });
    const [u] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY });
    expect(u.entries.map((e) => e.label)).toEqual(["Two eggs"]);
    store[ago(7)] = breakfast(ago(7));
    const [v] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY });
    expect(v.entries.map((e) => e.label)).toEqual(["Oats with milk", "coffee"]);
  });

  it("never offers a snack", () => {
    const snack = (d: string) => [entry(d, "snack", "Apple", [item("apple", 150, 80)], 16, 0)];
    const store = log({ [ago(1)]: snack(ago(1)), [ago(2)]: snack(ago(2)), [ago(3)]: snack(ago(3)) });
    expect(findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY })).toEqual([]);
  });
});

describe("findUsuals — who it is for", () => {
  it("leaves a meal to the plan when it's mostly ticked from the plan", () => {
    const store = log({ [ago(1)]: breakfast(ago(1)), [ago(2)]: breakfast(ago(2)), [ago(3)]: breakfast(ago(3)) });
    const intake: IntakeLedger = {};
    for (const n of [4, 5, 6]) {
      intake[ago(n)] = [{ slot: "breakfast", name: "Porridge", calories: 300, proteinG: 10, carbsG: 50, fatG: 6, at: `${ago(n)}T08:00:00+00:00` }];
    }
    expect(findUsuals({ foodLog: store, intake, forgotten: [], today: TODAY })).toEqual([]);
    delete intake[ago(6)];
    expect(findUsuals({ foodLog: store, intake, forgotten: [], today: TODAY })).toHaveLength(1);
  });
});

describe("findUsuals — not my usual any more", () => {
  it("forgets it, and only meals after the forget can bring it back", () => {
    const store = log({ [ago(5)]: breakfast(ago(5)), [ago(6)]: breakfast(ago(6)), [ago(7)]: breakfast(ago(7)) });
    const [u] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY });
    const forgotAt = new Date(2026, 10, 17, 12, 0).toISOString(); // ago(4), midday
    const forgotten = [{ id: u.id, at: forgotAt }];
    expect(findUsuals({ foodLog: store, intake: {}, forgotten, today: TODAY })).toEqual([]);
    for (const n of [1, 2, 3]) store[ago(n)] = breakfast(ago(n));
    const [back] = findUsuals({ foodLog: store, intake: {}, forgotten, today: TODAY });
    expect(back.days).toBe(3);
  });
});

describe("what it logs and says", () => {
  const store = log({ [ago(1)]: breakfast(ago(1), 8, 5), [ago(3)]: breakfast(ago(3), 8, 15), [ago(5)]: breakfast(ago(5), 8, 10) });
  const [u] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: TODAY });

  it("copies the most recent occurrence exactly, in logged order", () => {
    expect(u.entries).toEqual(store[ago(1)].map(({ label, items, totals, partialKeys, confidence, origin }) => ({ label, items, totals, partialKeys, confidence, origin })));
  });

  it("knows when it is usually eaten", () => {
    expect(u.usualMinute).toBe(8 * 60 + 10);
  });

  it("says it in the user's own words, with both numbers' scope", () => {
    expect(usualMessage(u)).toBe("Your usual breakfast? Oats with milk · coffee · about 420 kcal");
    expect(usualSource(u)).toBe("Logged on 3 of your last 14 days. Logs the same amounts as last time.");
    expect(usualReminderBody(u)).toBe("Your usual? Oats with milk, coffee");
  });

  it("drops the calories rather than guess them", () => {
    const partial = { ...u, calories: null };
    expect(usualMessage(partial)).toBe("Your usual breakfast? Oats with milk · coffee");
  });

  it("snapshots for the lock screen without the did-you-mean list", () => {
    const withAlts = { ...u, entries: u.entries.map((e) => ({ ...e, items: e.items.map((i) => ({ ...i, alternatives: [{ foodId: "x", name: "x", matchScore: 0.5 }] })) })) };
    const snap = snapshotOf(withAlts, new Date(2026, 10, 21, 7, 0));
    expect(isUsualSnapshot(snap)).toBe(true);
    expect(snap.entries[0].items[0]).not.toHaveProperty("alternatives");
    expect(snap.entries[0].items[0].nutrients).toEqual(u.entries[0].items[0].nutrients);
    expect(isUsualSnapshot({ ...snap, entries: [] })).toBe(false);
  });
});

describe("containsAll", () => {
  it("counts repeats", () => {
    expect(containsAll(["a", "b", "a"], ["a", "a"])).toBe(true);
    expect(containsAll(["a", "b"], ["a", "a"])).toBe(false);
  });
});
