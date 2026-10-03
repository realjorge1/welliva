/**
 * THE "DID YOU HAVE THESE?" NUDGE GETS ONE LOOK.
 *
 * It used to stand on the Diet screen for the whole day after any unticked
 * meal, and its close button was forgotten on the next launch. Now: five
 * minutes at most, ended for good by the close button, the clock or leaving
 * the screen — and only a NEW unlogged day brings it back.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { KEYS } from "../../OfflineStorage";
import {
  NUDGE_WINDOW_MS,
  closeNudge,
  markNudgeShown,
  nudgeOpen,
  nudgeRemaining,
  nudgeUnseen,
  readNudge,
  type NudgeRecord,
} from "../backlogNudge";

const YESTERDAY = "2026-10-01";
const T0 = Date.UTC(2026, 9, 2, 8, 0, 0);
const MIN = 60_000;

beforeEach(async () => {
  await AsyncStorage.removeItem(KEYS.BACKLOG_NUDGE);
});

describe("the rule", () => {
  const shown: NudgeRecord = { date: YESTERDAY, shownAt: T0, closed: false };

  it("lets a never-shown nudge on screen", () => {
    expect(nudgeUnseen(null, YESTERDAY)).toBe(true);
    expect(nudgeOpen(null, YESTERDAY, T0)).toBe(true);
  });

  it("gives it five minutes from the moment it first appeared, and no more", () => {
    expect(nudgeOpen(shown, YESTERDAY, T0 + 4 * MIN)).toBe(true);
    expect(nudgeRemaining(shown, YESTERDAY, T0 + 4 * MIN)).toBe(MIN);
    expect(nudgeOpen(shown, YESTERDAY, T0 + 5 * MIN)).toBe(false);
    expect(nudgeOpen(shown, YESTERDAY, T0 + 3 * 60 * MIN)).toBe(false);
    expect(nudgeRemaining(shown, YESTERDAY, T0 + 9 * MIN)).toBe(0);
  });

  it("keeps a closed nudge closed, however little of its time was used", () => {
    const closed = { ...shown, closed: true };
    expect(nudgeOpen(closed, YESTERDAY, T0 + MIN)).toBe(false);
    expect(nudgeRemaining(closed, YESTERDAY, T0 + MIN)).toBe(0);
  });

  it("asks again only when there is a new day to ask about", () => {
    const closed = { ...shown, closed: true };
    expect(nudgeUnseen(closed, "2026-10-02")).toBe(true);
    expect(nudgeOpen(closed, "2026-10-02", T0 + 24 * 60 * MIN)).toBe(true);
    expect(nudgeRemaining(closed, "2026-10-02", T0)).toBe(NUDGE_WINDOW_MS);
  });
});

describe("the record", () => {
  it("starts the clock once — showing it again keeps the first time", async () => {
    const first = await markNudgeShown(YESTERDAY, T0);
    const again = await markNudgeShown(YESTERDAY, T0 + 3 * MIN);
    expect(again).toEqual(first);
    expect((await readNudge())?.shownAt).toBe(T0);
  });

  it("survives a relaunch closed, so the card does not come back", async () => {
    await markNudgeShown(YESTERDAY, T0);
    await closeNudge(YESTERDAY, T0 + MIN);
    const record = await readNudge();
    expect(record).toEqual({ date: YESTERDAY, shownAt: T0, closed: true });
    expect(nudgeOpen(record, YESTERDAY, T0 + 2 * MIN)).toBe(false);
  });

  it("can be closed before it was ever stamped shown", async () => {
    await closeNudge(YESTERDAY, T0);
    expect(nudgeOpen(await readNudge(), YESTERDAY, T0)).toBe(false);
  });

  it("starts fresh for the next unlogged day", async () => {
    await markNudgeShown(YESTERDAY, T0);
    await closeNudge(YESTERDAY, T0 + MIN);
    const next = await markNudgeShown("2026-10-02", T0 + 24 * 60 * MIN);
    expect(next).toEqual({ date: "2026-10-02", shownAt: T0 + 24 * 60 * MIN, closed: false });
  });
});
