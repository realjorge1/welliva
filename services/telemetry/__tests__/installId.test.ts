/**
 * The anonymous install id. Three properties matter, and each one is a claim the
 * privacy policy now makes out loud:
 *
 *  1. It is a well-formed v4 UUID — the column is `uuid`, and Postgres rejects
 *     anything else, so a malformed id silently loses the whole batch.
 *  2. It is STABLE for the life of the install. If it churned, every cohort
 *     would count one person as many installs and retention would read as zero.
 *  3. It can be RESET, and the reset is what makes "reinstalling replaces it, and
 *     earlier events can no longer be connected to you" true rather than a nice
 *     sentence in a policy.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { DEVICE_LOCAL_KEYS } from "../../sync/syncKeys";
import { ANALYTICS_ACTIVATED_KEY, ANALYTICS_QUEUE_KEY } from "../Analytics";
import {
  __resetInstallIdCache,
  getInstallId,
  INSTALL_ID_KEY,
  resetInstallId,
} from "../installId";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("getInstallId", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(INSTALL_ID_KEY);
    __resetInstallIdCache();
  });

  it("mints a well-formed v4 UUID", async () => {
    expect(await getInstallId()).toMatch(UUID_V4);
  });

  it("returns the same id on every later call", async () => {
    const first = await getInstallId();
    expect(await getInstallId()).toBe(first);
    // ...and still the same after the in-memory memo is dropped, because it was
    // persisted. This is the property that makes retention measurable at all.
    __resetInstallIdCache();
    expect(await getInstallId()).toBe(first);
  });

  it("persists under the app-owned key, so the purge sweep can find it", async () => {
    const id = await getInstallId();
    expect(await AsyncStorage.getItem(INSTALL_ID_KEY)).toBe(id);
    // Must live under an app prefix (services/sync/syncKeys scans these), and must
    // be on the device-local denylist so it never follows the user to a second phone.
    expect(INSTALL_ID_KEY.startsWith("@welliva_")).toBe(true);
  });

  it("mints a DIFFERENT id after a reset", async () => {
    const before = await getInstallId();
    await resetInstallId();
    const after = await getInstallId();

    expect(after).toMatch(UUID_V4);
    expect(after).not.toBe(before);
  });

  it("generates distinct ids across many mints", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      await resetInstallId();
      ids.add(await getInstallId());
    }
    expect(ids.size).toBe(200);
  });

  it("ignores a stored value too short to be an id", async () => {
    // Guards against a truncated or half-written key reading as a real install.
    await AsyncStorage.setItem(INSTALL_ID_KEY, "nope");
    __resetInstallIdCache();

    const id = await getInstallId();
    expect(id).toMatch(UUID_V4);
    expect(id).not.toBe("nope");
  });
});

describe("the device-local contract", () => {
  // Syncing any of these would collapse two phones into one "install" and make
  // every retention cohort wrong in the direction that flatters us.
  it("keeps the install id, the queue and the activation latch device-local", () => {
    expect(DEVICE_LOCAL_KEYS).toContain(INSTALL_ID_KEY);
    expect(DEVICE_LOCAL_KEYS).toContain(ANALYTICS_QUEUE_KEY);
    expect(DEVICE_LOCAL_KEYS).toContain(ANALYTICS_ACTIVATED_KEY);
  });
});
