/**
 * Migration 003 — remap the activity scale to the full five Mifflin-St Jeor tiers.
 *
 * The app shipped four tiers, with `very_active` = 1.725. The scale actually has
 * five, and the missing top tier ("extra active": physical job AND daily
 * training, 1.9) meant the most engaged users were under-prescribed by ~10% of
 * TDEE. models/user.ts now defines all five.
 *
 * That renames the 1.725 slot: it used to be `very_active`, it is now `active`.
 * Without this migration every existing `very_active` user would silently jump
 * from 1.725 to 1.9 — a 250-350 kcal/day increase nobody asked for and nothing
 * explained. So we rewrite stored `very_active` → `active`, which keeps their
 * multiplier at exactly the value they already had. Choosing the genuine 1.9
 * tier becomes an explicit, user-made choice in onboarding/settings.
 *
 * Idempotent: after the rewrite no `very_active` remains, so a re-run is a no-op.
 * The value it writes (`active`) is never itself remapped.
 *
 * Zero data risk: if anything throws, schema_version stays unadvanced and the
 * bio is left untouched — and the defensive `?? ACTIVITY_MULTIPLIERS.moderate`
 * lookups in NutritionService/TargetsVersion mean an unmigrated value still
 * yields a sane number rather than NaN.
 *
 * See docs/architecture/04-migration-strategy.md.
 */
import { LEGACY } from "../storage/keys";
import type { Migration, MigrationReport } from "./runner";

/** Bio shape this migration touches. Deliberately narrow — it rewrites one field. */
type BioWithActivity = { activityLevel?: string } & Record<string, unknown>;

export const migration003: Migration = {
  version: 3,
  name: "activity-level-scale",

  async up({ store }): Promise<MigrationReport> {
    const bio = await store.get<BioWithActivity | null>(LEGACY.USER_BIO, null);

    // No profile yet (fresh install, or onboarding not finished) — nothing to
    // preserve. New users pick from the five-tier list directly.
    if (!bio || typeof bio !== "object") {
      return { migrated: 0, reason: "no-bio" };
    }

    if (bio.activityLevel !== "very_active") {
      return { migrated: 0, activityLevel: bio.activityLevel ?? "unset" };
    }

    await store.set(LEGACY.USER_BIO, { ...bio, activityLevel: "active" });

    // Read back and assert, so a storage failure fails the migration loudly
    // instead of advancing the version over a bio that never changed.
    const after = await store.get<BioWithActivity | null>(LEGACY.USER_BIO, null);
    if (after?.activityLevel !== "active") {
      throw new Error(
        `activity remap did not persist: expected "active", got "${after?.activityLevel}"`,
      );
    }

    return { migrated: 1, from: "very_active", to: "active" };
  },
};
