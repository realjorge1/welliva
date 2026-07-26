/**
 * health-os/platform/migrations — public API.
 *
 * `migrate(store?)` is the one call the app makes at boot (top of
 * AppContext.loadData) to bring storage to the current schema before any read.
 */
import { store as defaultStore } from "../storage/AsyncStorageAdapter";
import type { KeyValueStore } from "../storage/KeyValueStore";
import { REGISTRY } from "./registry";
import { runMigrations } from "./runner";

export * from "./runner";
export { REGISTRY, LATEST_VERSION } from "./registry";

/** Run all pending migrations against `store` (defaults to the app store). */
export function migrate(
  store: KeyValueStore = defaultStore,
  now?: Date,
): Promise<number> {
  return runMigrations(store, REGISTRY, now);
}
