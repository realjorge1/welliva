import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { isDeviceLocalKey, isSyncedKey } from "../../sync/syncKeys";
import {
  CYCLE_KEYS,
  CYCLE_LOCAL_KEYS,
  eraseCycleData,
  loadCycleData,
  moveCycleData,
  pruneDays,
  saveDays,
  savePeriods,
  saveSettings,
} from "../store";
import { day, days, period, settings } from "./helpers";

async function keys(): Promise<string[]> {
  return [...(await AsyncStorage.getAllKeys())].filter((k) => k.includes("cycle")).sort();
}

beforeEach(async () => {
  const all = await AsyncStorage.getAllKeys();
  for (const k of all) await AsyncStorage.removeItem(k);
});

describe("where the cycle log lives", () => {
  it("is backed up by default: the synced keys sync, the device-only twins never do", () => {
    expect(isSyncedKey(CYCLE_KEYS.periods)).toBe(true);
    expect(isSyncedKey(CYCLE_KEYS.days)).toBe(true);
    expect(isSyncedKey(CYCLE_KEYS.settings)).toBe(true);
    for (const k of Object.values(CYCLE_LOCAL_KEYS)) {
      expect(isDeviceLocalKey(k)).toBe(true);
      expect(isSyncedKey(k)).toBe(false);
    }
    expect(isSyncedKey("@welliva_cycle_reminder_ids")).toBe(false);
  });

  it("round-trips through the backed-up keys", async () => {
    const s = settings({ usualCycleDays: 29 });
    await saveSettings(s);
    await savePeriods([period("2026-09-01")], true);
    await saveDays(days(day("2026-09-02", { symptoms: ["cramps"] })), true);
    const data = await loadCycleData();
    expect(data.settings).toMatchObject({ enabled: true, usualCycleDays: 29, backupOn: true });
    expect(data.periods).toHaveLength(1);
    expect(data.days["2026-09-02"].symptoms).toEqual(["cramps"]);
    expect(await keys()).toEqual([...Object.values(CYCLE_KEYS)].sort());
  });

  it("moves to the device-only keys when backup is switched off, and back again", async () => {
    await saveSettings(settings());
    await savePeriods([period("2026-09-01")], true);
    const before = await loadCycleData();

    await moveCycleData(before, false);
    expect(await keys()).toEqual([...Object.values(CYCLE_LOCAL_KEYS)].sort());
    const local = await loadCycleData();
    expect(local.settings.backupOn).toBe(false);
    expect(local.periods).toHaveLength(1);

    await moveCycleData(local, true);
    expect(await keys()).toEqual([...Object.values(CYCLE_KEYS)].sort());
    expect((await loadCycleData()).settings.backupOn).toBe(true);
  });

  it("finishes a move that a crash interrupted, without losing anything", async () => {
    // Off-move died after flipping the marker but before removing the old copy.
    await AsyncStorage.setItem(CYCLE_LOCAL_KEYS.settings, JSON.stringify(settings({ backupOn: false })));
    await AsyncStorage.setItem(CYCLE_LOCAL_KEYS.periods, JSON.stringify([period("2026-09-01")]));
    await AsyncStorage.setItem(CYCLE_KEYS.periods, JSON.stringify([period("2026-09-01")]));
    const data = await loadCycleData();
    expect(data.settings.backupOn).toBe(false);
    expect(data.periods).toHaveLength(1);
    expect(await AsyncStorage.getItem(CYCLE_KEYS.periods)).toBeNull();
  });

  it("erases everything, in both places", async () => {
    await saveSettings(settings());
    await AsyncStorage.setItem(CYCLE_LOCAL_KEYS.days, "{}");
    await eraseCycleData();
    expect(await keys()).toEqual([]);
    expect((await loadCycleData()).settings.enabled).toBe(false);
  });
});

describe("pruneDays", () => {
  it("keeps two years, and a cleared day only as long as it's needed as a tombstone", () => {
    const pruned = pruneDays(
      {
        "2024-09-01": day("2024-09-01", { symptoms: ["cramps"] }),
        "2026-01-10": day("2026-01-10", { symptoms: ["cramps"] }),
        "2026-02-01": { date: "2026-02-01", updatedAt: "2026-02-01T08:00:00.000Z" },
        "2026-10-01": { date: "2026-10-01", updatedAt: "2026-10-01T08:00:00.000Z" },
      },
      "2026-10-15",
    );
    expect(Object.keys(pruned).sort()).toEqual(["2026-01-10", "2026-10-01"]);
  });
});
