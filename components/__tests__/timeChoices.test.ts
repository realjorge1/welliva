/**
 * withStoredTime — a picker shows the time a reminder actually holds.
 */
import { describe, expect, it } from "vitest";

import { withStoredTime } from "../smart/timeChoices";

type T = { hour: number; minute: number };
const at = (t: T) => t.hour * 60 + t.minute;
const BREAKFAST: T[] = [
  { hour: 6, minute: 30 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 30 },
  { hour: 9, minute: 30 },
];

describe("withStoredTime", () => {
  it("leaves the list alone when the stored time is on it", () => {
    expect(withStoredTime(BREAKFAST, { hour: 8, minute: 30 }, at)).toEqual(BREAKFAST);
  });

  it("puts a moved time in place of the nearest offered one, in order", () => {
    expect(withStoredTime(BREAKFAST, { hour: 7, minute: 55 }, at)).toEqual([
      { hour: 6, minute: 30 },
      { hour: 7, minute: 55 },
      { hour: 8, minute: 30 },
      { hour: 9, minute: 30 },
    ]);
  });

  it("keeps the row its length, whatever the time", () => {
    expect(withStoredTime(BREAKFAST, { hour: 11, minute: 5 }, at)).toHaveLength(4);
    expect(withStoredTime(BREAKFAST, { hour: 11, minute: 5 }, at)[3]).toEqual({ hour: 11, minute: 5 });
  });

  it("does nothing without a stored time", () => {
    expect(withStoredTime(BREAKFAST, null, at)).toEqual(BREAKFAST);
  });
});
