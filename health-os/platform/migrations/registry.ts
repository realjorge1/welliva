/**
 * health-os/platform/migrations/registry.ts
 *
 * The ordered list of migrations. Add new migrations here in ascending version order.
 * See docs/architecture/04-migration-strategy.md §3.
 */
import { migration001 } from "./001-backfill-timeline";
import { migration002 } from "./002-seed-summaries";
import type { Migration } from "./runner";

export const REGISTRY: Migration[] = [migration001, migration002];

export const LATEST_VERSION = REGISTRY.reduce(
  (max, m) => Math.max(max, m.version),
  0,
);
