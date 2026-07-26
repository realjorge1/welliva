/**
 * UserScope — the per-device account isolation that stops one phone from leaking
 * data between accounts. These tests pin the three cases that matter:
 *   same user → keep local; different/first user → purge + claim; and that the
 *   purge catches keys NO allowlist would have listed (the whole point).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_USER_KEY } from "../syncKeys";
import { ensureDeviceOwnedBy, getActiveUserId, purgeAppData } from "../UserScope";

async function clearStorage() {
  const keys = await AsyncStorage.getAllKeys();
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

beforeEach(clearStorage);

describe("ensureDeviceOwnedBy", () => {
  it("first-ever user: no data to purge, claims the device, returns true", async () => {
    const purged = await ensureDeviceOwnedBy("user-A");
    expect(purged).toBe(true);
    expect(await getActiveUserId()).toBe("user-A");
  });

  it("same user again: keeps local data and returns false", async () => {
    await ensureDeviceOwnedBy("user-A");
    await AsyncStorage.setItem("@welliva_streak_data", JSON.stringify({ n: 7 }));

    const purged = await ensureDeviceOwnedBy("user-A");
    expect(purged).toBe(false);
    // Their data is untouched.
    expect(await AsyncStorage.getItem("@welliva_streak_data")).toBe(
      JSON.stringify({ n: 7 }),
    );
    expect(await getActiveUserId()).toBe("user-A");
  });

  it("different user: purges the previous account's data and claims the device", async () => {
    await ensureDeviceOwnedBy("user-A");
    await AsyncStorage.setItem("@welliva_streak_data", JSON.stringify({ n: 7 }));
    await AsyncStorage.setItem("@gozlin_identity", JSON.stringify({ x: 1 }));

    const purged = await ensureDeviceOwnedBy("user-B");
    expect(purged).toBe(true);
    expect(await AsyncStorage.getItem("@welliva_streak_data")).toBeNull();
    expect(await AsyncStorage.getItem("@gozlin_identity")).toBeNull();
    expect(await getActiveUserId()).toBe("user-B");
  });

  it("purges keys an allowlist would have MISSED (health-os, fitness, gozlin)", async () => {
    await ensureDeviceOwnedBy("user-A");
    // None of these were in the original plan's SYNCED/DEVICE_LOCAL lists.
    await AsyncStorage.setItem("@welliva_timeline_2026-07", "[]");
    await AsyncStorage.setItem("@welliva_fitness_profile", "{}");
    await AsyncStorage.setItem("@welliva_story_archive", "[]");
    await AsyncStorage.setItem("@gozlin_episodic", "[]");

    await ensureDeviceOwnedBy("user-B");

    for (const k of [
      "@welliva_timeline_2026-07",
      "@welliva_fitness_profile",
      "@welliva_story_archive",
      "@gozlin_episodic",
    ]) {
      expect(await AsyncStorage.getItem(k)).toBeNull();
    }
  });

  it("leaves non-app keys (e.g. themeMode) alone on purge", async () => {
    await ensureDeviceOwnedBy("user-A");
    await AsyncStorage.setItem("themeMode", "dark");

    await ensureDeviceOwnedBy("user-B");
    expect(await AsyncStorage.getItem("themeMode")).toBe("dark");
  });
});

describe("purgeAppData", () => {
  it("removes every @welliva_/@gozlin_ key and nothing else", async () => {
    await AsyncStorage.setItem("@welliva_habits", "[]");
    await AsyncStorage.setItem("@gozlin_conversation", "[]");
    await AsyncStorage.setItem("themeMode", "light");

    await purgeAppData();

    expect(await AsyncStorage.getItem("@welliva_habits")).toBeNull();
    expect(await AsyncStorage.getItem("@gozlin_conversation")).toBeNull();
    expect(await AsyncStorage.getItem("themeMode")).toBe("light");
  });

  it("is safe to call with an empty store", async () => {
    await expect(purgeAppData()).resolves.toBeUndefined();
  });
});

describe("isSyncedKey coverage sanity", () => {
  it("ACTIVE_USER_KEY is bookkeeping, never synced", async () => {
    const { isSyncedKey } = await import("../syncKeys");
    expect(isSyncedKey(ACTIVE_USER_KEY)).toBe(false);
  });
});
