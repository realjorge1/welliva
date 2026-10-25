/**
 * THE MENU MODEL — and the one row that comes and goes.
 *
 * Cycle is the only conditional destination in the drawer, which makes the row
 * count a variable for the first time. Three things have to stay true, and none
 * of them is visible until something is already broken on a real phone:
 *
 *   · the fixed rows never MOVE when Cycle appears — a destination arriving is
 *     a change she made; a destination shuffling under her thumb is a bug she
 *     can feel;
 *   · Cycle stays in the derived sets (the swipe gesture, the navigator) even
 *     while the row is hidden, so someone who arrives at /cycle from a
 *     notification is never stranded without a swipe out;
 *   · the vertical rhythm still fits with the extra row on the shortest phone
 *     the app supports.
 */

import { describe, expect, it } from "vitest";

import {
  ALL_MENU_ITEMS,
  COMPACT_RAIL_PATHS,
  CYCLE_ITEM,
  PRIMARY_ITEMS,
  RAIL_ITEMS,
  SECONDARY_ITEMS,
  SWIPEABLE_PATHS,
  primaryItems,
} from "../menu";
import { GAP_MIN, LIFT_TIGHT, ROW_MIN, menuContentHeight, menuRhythm, type MenuShape } from "../menuRhythm";

const routes = (items: { route: string }[]) => items.map((i) => i.route);

describe("primaryItems", () => {
  it("leaves the list exactly as specified when she isn't tracking", () => {
    expect(primaryItems({ cycle: false })).toEqual(PRIMARY_ITEMS);
  });

  it("slots Cycle after Habits and before Logs", () => {
    expect(routes(primaryItems({ cycle: true }))).toEqual([
      "index",
      "diet",
      "exercise",
      "gozlin",
      "habits",
      "cycle",
      "logs",
    ]);
  });

  it("moves nothing else when the row appears", () => {
    const without = routes(primaryItems({ cycle: false }));
    const with_ = routes(primaryItems({ cycle: true })).filter((r) => r !== "cycle");
    expect(with_).toEqual(without);
  });

  it("never mutates the spine it is derived from", () => {
    const before = routes(PRIMARY_ITEMS);
    primaryItems({ cycle: true });
    primaryItems({ cycle: true });
    expect(routes(PRIMARY_ITEMS)).toEqual(before);
  });
});

describe("the derived sets", () => {
  it("keeps /cycle swipeable whether or not the row is showing", () => {
    expect(SWIPEABLE_PATHS.has(CYCLE_ITEM.href)).toBe(true);
  });

  it("lists Cycle as a navigator destination exactly once", () => {
    expect(ALL_MENU_ITEMS.filter((i) => i.route === "cycle")).toHaveLength(1);
  });

  it("gives Cycle the full rail, like the other daily surfaces", () => {
    // Compact is for screens you open to answer a question or change the app.
    // The cycle screen is a check you make, not a question you go and ask.
    expect(COMPACT_RAIL_PATHS.has(CYCLE_ITEM.href)).toBe(false);
  });

  it("does not put Cycle on the rail — four tabs, and it isn't one", () => {
    expect(routes(RAIL_ITEMS)).not.toContain("cycle");
  });

  it("has a unique route and href for every destination", () => {
    expect(new Set(routes(ALL_MENU_ITEMS)).size).toBe(ALL_MENU_ITEMS.length);
    expect(new Set(ALL_MENU_ITEMS.map((i) => i.href)).size).toBe(ALL_MENU_ITEMS.length);
  });
});

describe("the rhythm with the extra row", () => {
  /** The panel's shape, for a given primary list. */
  const shapeFor = (cycle: boolean): MenuShape => ({
    listRows: primaryItems({ cycle }).length + SECONDARY_ITEMS.length,
    footerRows: 2,
    hairline: 0.36,
  });

  it("counts the conditional row", () => {
    expect(shapeFor(false).listRows).toBe(8);
    expect(shapeFor(true).listRows).toBe(9);
  });

  it("still fits on a short phone, with the list scrolling", () => {
    // ~568dp device, ~76dp header: the shortest body the app is tuned for.
    const body = 470;
    const shape = shapeFor(true);
    const r = menuRhythm(body, 0, shape);

    // No slack at nine rows, so the metrics are the tight ones and the footer
    // stays in view beneath a scrolling list.
    expect(r).toEqual({ row: ROW_MIN, gap: GAP_MIN, lift: LIFT_TIGHT });
    expect(menuContentHeight(shape, r.row, r.gap)).toBeGreaterThan(body);
  });

  it("spends a tall phone's slack on nine rows without overflowing it", () => {
    // The owner's phone: ~790dp tall, ~76dp header, no reported bottom inset.
    const body = 714;
    const shape = shapeFor(true);
    const r = menuRhythm(body, 0, shape);

    expect(r.row).toBeGreaterThan(ROW_MIN);
    expect(menuContentHeight(shape, r.row, r.gap) + r.lift).toBeLessThanOrEqual(body);
  });

  it("gives a row at least as much room with nine rows as the tight layout did", () => {
    const body = 714;
    expect(menuRhythm(body, 0, shapeFor(true)).row).toBeGreaterThanOrEqual(ROW_MIN);
  });
});
