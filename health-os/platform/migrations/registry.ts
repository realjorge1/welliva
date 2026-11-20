/**
 * health-os/platform/migrations/registry.ts
 *
 * The ordered list of migrations. Add new migrations here in ascending version order.
 * See docs/architecture/04-migration-strategy.md §3.
 */
import { migration001 } from "./001-backfill-timeline";
import { migration002 } from "./002-seed-summaries";
import { migration003 } from "./003-activity-level-scale";
import { migration004 } from "./004-mind-valence";
import { migration005 } from "./005-catch-up-learning-days";
import type { Migration } from "./runner";

export const REGISTRY: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
];

export const LATEST_VERSION = REGISTRY.reduce(
  (max, m) => Math.max(max, m.version),
  0,
);
