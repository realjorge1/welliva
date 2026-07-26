/**
 * health-os/platform/migrations/runner.ts
 *
 * Version-gated, ordered, idempotent migration runner. Invoked at the top of
 * AppContext.loadData (before the first read) so storage is at the current schema
 * before anything reads it.
 *
 * Forward-only. A migration that throws does NOT advance the version — the app simply
 * keeps running on the legacy data (zero data loss). Each step is journaled.
 *
 * See docs/architecture/04-migration-strategy.md.
 */
import { K } from "../storage/keys";
import type { KeyValueStore } from "../storage/KeyValueStore";

export interface MigrationContext {
  store: KeyValueStore;
  /** Injectable clock for deterministic tests. */
  now: Date;
}

export type MigrationReport = Record<string, number | string>;

export interface Migration {
  /** Schema version AFTER this migration runs. */
  version: number;
  name: string;
  /** Must be idempotent. */
  up(ctx: MigrationContext): Promise<MigrationReport>;
}

export interface JournalEntry {
  version: number;
  name: string;
  startedAt: string;
  completedAt?: string;
  status: "started" | "completed" | "failed";
  report?: MigrationReport;
  error?: string;
}

async function appendJournal(store: KeyValueStore, entry: JournalEntry): Promise<void> {
  const log = await store.get<JournalEntry[]>(K.MIGRATION_JOURNAL, []);
  log.push(entry);
  await store.set(K.MIGRATION_JOURNAL, log);
}

async function patchLastJournal(
  store: KeyValueStore,
  version: number,
  patch: Partial<JournalEntry>,
): Promise<void> {
  const log = await store.get<JournalEntry[]>(K.MIGRATION_JOURNAL, []);
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].version === version && log[i].status === "started") {
      log[i] = { ...log[i], ...patch };
      break;
    }
  }
  await store.set(K.MIGRATION_JOURNAL, log);
}

/**
 * Run all pending migrations, lowest-version-first. Idempotent: already-applied
 * versions are skipped; a re-run after a clean pass does no work.
 */
export async function runMigrations(
  store: KeyValueStore,
  registry: Migration[],
  now: Date = new Date(),
): Promise<number> {
  const current = await store.get<number>(K.SCHEMA_VERSION, 0);
  const pending = registry
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);

  let applied = current;
  for (const m of pending) {
    await appendJournal(store, {
      version: m.version,
      name: m.name,
      startedAt: now.toISOString(),
      status: "started",
    });
    try {
      const report = await m.up({ store, now });
      await store.set(K.SCHEMA_VERSION, m.version); // commit version LAST
      await patchLastJournal(store, m.version, {
        status: "completed",
        completedAt: new Date().toISOString(),
        report,
      });
      applied = m.version;
    } catch (e) {
      await patchLastJournal(store, m.version, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
      // Stop the chain; leave schema_version unadvanced. App continues on legacy data.
      console.error(`[migrations] ${m.version} "${m.name}" failed:`, e);
      break;
    }
  }
  return applied;
}
