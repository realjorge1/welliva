/**
 * SyncEngine — the document-mirror orchestration. Backed by an in-memory fake of
 * the `sync_documents` table so we exercise the real push/pull/merge logic, not a
 * stub. These pin the behaviours the plan promised AND the correction that makes
 * it actually work: the change-detecting sweep that catches services which write
 * AsyncStorage directly (streaks, achievements, …).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Fake Supabase: an in-memory sync_documents table -----------------------
vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

vi.mock("../../../lib/supabase", () => {
  interface Row {
    user_id: string;
    doc_key: string;
    doc: unknown;
    deleted_at: string | null;
    updated_at: string;
    device_id?: string | null;
  }
  const rows: Row[] = [];
  let clock = 0;
  let failPush = false;
  const nextStamp = () =>
    new Date(1_700_000_000_000 + (clock += 1) * 1000).toISOString();

  const from = () => {
    const state: {
      payload: Record<string, unknown> | null;
      filters: ((r: Row) => boolean)[];
    } = { payload: null, filters: [] };
    const q: Record<string, unknown> = {};
    q.upsert = (payload: Record<string, unknown>) => {
      state.payload = payload;
      return q;
    };
    q.select = () => q;
    q.eq = (c: string, v: unknown) => {
      state.filters.push((r) => (r as unknown as Record<string, unknown>)[c] === v);
      return q;
    };
    q.gt = (c: string, v: string) => {
      state.filters.push(
        (r) => ((r as unknown as Record<string, unknown>)[c] as string) > v,
      );
      return q;
    };
    q.order = () =>
      Promise.resolve({
        data: rows
          .filter((r) => state.filters.every((f) => f(r)))
          .sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))
          .map((r) => ({ ...r })),
        error: null,
      });
    q.single = () => {
      if (failPush) {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      const p = state.payload as unknown as Row;
      const updated_at = nextStamp();
      const existing = rows.find(
        (r) => r.user_id === p.user_id && r.doc_key === p.doc_key,
      );
      if (existing) Object.assign(existing, p, { updated_at });
      else rows.push({ ...p, updated_at });
      return Promise.resolve({ data: { updated_at }, error: null });
    };
    return q;
  };

  return {
    supabase: {
      from,
      __rows: rows,
      __reset() {
        rows.length = 0;
        clock = 0;
        failPush = false;
      },
      __setFailPush(v: boolean) {
        failPush = v;
      },
      __seed(userId: string, key: string, value: string | null) {
        rows.push({
          user_id: userId,
          doc_key: key,
          doc: value,
          deleted_at: value === null ? new Date().toISOString() : null,
          updated_at: nextStamp(),
        });
      },
    },
  };
});

import { writeJSON } from "../../OfflineStorage";
import { supabase } from "../../../lib/supabase";
import {
  flushOutbox,
  hasPendingWrites,
  reconcileOnLogin,
  startAutoSync,
} from "../SyncEngine";
import { OUTBOX_KEY } from "../syncKeys";

// Typed handle to the fake's control surface.
const fake = supabase as unknown as {
  __rows: { doc_key: string; doc: unknown; deleted_at: string | null }[];
  __reset(): void;
  __setFailPush(v: boolean): void;
  __seed(userId: string, key: string, value: string | null): void;
};

const USER = "user-1";

async function clearStorage() {
  const keys = await AsyncStorage.getAllKeys();
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
async function readOutbox(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  return raw ? JSON.parse(raw) : [];
}
const cloudDoc = (key: string) => fake.__rows.find((r) => r.doc_key === key);
const tick = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  await clearStorage();
  fake.__reset();
});

describe("reconcileOnLogin — a fresh device", () => {
  it("adopts every remote doc and does not echo them back up", async () => {
    fake.__seed(USER, "@welliva_streak_data", JSON.stringify({ n: 12 }));
    fake.__seed(USER, "@gozlin_identity", JSON.stringify({ pref: "mornings" }));

    await reconcileOnLogin(USER);

    expect(await AsyncStorage.getItem("@welliva_streak_data")).toBe(
      JSON.stringify({ n: 12 }),
    );
    expect(await AsyncStorage.getItem("@gozlin_identity")).toBe(
      JSON.stringify({ pref: "mornings" }),
    );
    // Adopted values are recorded as already-pushed, so the sweep leaves the
    // outbox empty rather than re-uploading what we just downloaded.
    expect(await readOutbox()).toEqual([]);
    expect(fake.__rows).toHaveLength(2);
  });
});

describe("reconcileOnLogin — merge", () => {
  it("adopts a remote doc that is newer than our watermark", async () => {
    await AsyncStorage.setItem("@welliva_habits", JSON.stringify(["old"]));
    fake.__seed(USER, "@welliva_habits", JSON.stringify(["new-from-other-phone"]));

    await reconcileOnLogin(USER);

    expect(await AsyncStorage.getItem("@welliva_habits")).toBe(
      JSON.stringify(["new-from-other-phone"]),
    );
  });

  it("keeps a locally-dirty key and pushes it up instead of adopting remote", async () => {
    // Local edit not yet synced: it's in the outbox (dirty).
    await AsyncStorage.setItem("@welliva_habits", JSON.stringify(["local-edit"]));
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(["@welliva_habits"]));
    fake.__seed(USER, "@welliva_habits", JSON.stringify(["stale-remote"]));

    await reconcileOnLogin(USER);

    // Local wins and is uploaded; the remote copy is overwritten.
    expect(await AsyncStorage.getItem("@welliva_habits")).toBe(
      JSON.stringify(["local-edit"]),
    );
    expect(cloudDoc("@welliva_habits")?.doc).toBe(JSON.stringify(["local-edit"]));
  });
});

describe("fullPushSweep via reconcile — catches direct-AsyncStorage writers", () => {
  it("pushes streaks/achievements that never went through OfflineStorage", async () => {
    // Simulate StreakService/AchievementService writing AsyncStorage directly.
    await AsyncStorage.setItem("@welliva_streak_data", JSON.stringify({ n: 5 }));
    await AsyncStorage.setItem("@welliva_achievements", JSON.stringify(["first"]));

    await reconcileOnLogin(USER); // no observer involved at all

    expect(cloudDoc("@welliva_streak_data")?.doc).toBe(JSON.stringify({ n: 5 }));
    expect(cloudDoc("@welliva_achievements")?.doc).toBe(JSON.stringify(["first"]));
  });
});

describe("flushOutbox — resilience", () => {
  it("keeps failed keys queued and drains them on the next retry", async () => {
    await AsyncStorage.setItem("@welliva_journey", JSON.stringify({ ch: 3 }));
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(["@welliva_journey"]));

    fake.__setFailPush(true);
    await flushOutbox(USER);
    expect(await readOutbox()).toEqual(["@welliva_journey"]); // still queued
    expect(cloudDoc("@welliva_journey")).toBeUndefined();
    expect(await hasPendingWrites()).toBe(true);

    fake.__setFailPush(false);
    await flushOutbox(USER);
    expect(await readOutbox()).toEqual([]); // drained
    expect(cloudDoc("@welliva_journey")?.doc).toBe(JSON.stringify({ ch: 3 }));
  });
});

describe("startAutoSync — the write observer", () => {
  it("enqueues a synced write and ignores a device-local write", async () => {
    const stop = startAutoSync(USER);
    try {
      await writeJSON("@welliva_habits", ["water"]); // synced
      await writeJSON("@welliva_last_active_date", "2026-07-23"); // device-local
      await tick();

      const outbox = await readOutbox();
      expect(outbox).toContain("@welliva_habits");
      expect(outbox).not.toContain("@welliva_last_active_date");
    } finally {
      stop();
    }
  });
});
