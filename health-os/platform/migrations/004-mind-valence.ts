/**
 * Migration 004 — remap self-reported mood from the 1–5 dial to valence.
 *
 * The check-in sheet asked for mood, energy and stress on three 1–5 dot rows.
 * State-of-mind logging replaced that with one continuous valence axis, −1 (very
 * unpleasant) to +1 (very pleasant), named at seven stops, plus emotion labels
 * and life-domain associations (see services/gozlin/mind.ts).
 *
 * Without this migration every stored check-in would read as having no valence
 * at all, and the mood domain score — which the coach reports — would silently
 * restart from an empty window for anyone who had been logging. So each record's
 * `mood` is rewritten to the valence that means the same thing, on the five-stop
 * symmetric table below.
 *
 * The plain "Unpleasant" and "Pleasant" stops stay unoccupied by history, which
 * is the honest outcome: a 5-point scale cannot tell "unpleasant" from "slightly
 * unpleasant", and claiming the stronger reading would overstate what the user
 * actually said.
 *
 * ── WHAT IS NOT TOUCHED ─────────────────────────────────────────────────────
 * `sleepHours` is carried through unchanged — it is not a feeling, and both
 * detectSleepLink and the learning engine still read it. `energy` and `stress`
 * are LEFT IN PLACE rather than deleted: they cost nothing, they keep the
 * migration a pure addition, and a record that still holds them is evidence of
 * what was asked at the time. Nothing reads them any more. No LABELS are
 * invented from a high `stress` value, for the same reason the middle stops stay
 * empty — the user never picked the word "Stressed", and the engine must not
 * report it as if they had.
 *
 * Timeline events from migration 001 also carry the legacy 1–5 payload. Those
 * are NOT rewritten: L1 is append-only by design, and every reader goes through
 * `readValence`, which understands both shapes.
 *
 * Idempotent: a record that already has a numeric `valence` is skipped, so a
 * re-run migrates nothing. Records with no `mood` at all (sleep-only check-ins)
 * are stamped with a kind and an id but left without a valence, because they
 * never carried a feeling to convert.
 *
 * Zero data risk: if anything throws, schema_version stays unadvanced and the
 * store is left untouched. Readers tolerate an unmigrated record — `readValence`
 * falls back to the legacy `mood` field — so a failure degrades to "the old
 * numbers still work" rather than to a blank history.
 *
 * See docs/architecture/04-migration-strategy.md.
 */
import { LEGACY } from "../storage/keys";
import type { Migration, MigrationReport } from "./runner";

/** Narrow view of the stored record — this migration touches four fields. */
type StoredCheckin = {
  date?: string;
  id?: string;
  kind?: string;
  valence?: number;
  mood?: number;
  createdAt?: number;
} & Record<string, unknown>;

/**
 * 1–5 → valence, mapped onto five of the seven stops, SYMMETRICALLY about
 * Neutral:
 *
 *     1 → −1      (Very Unpleasant)
 *     2 → −1/3    (Slightly Unpleasant)
 *     3 →  0      (Neutral)
 *     4 → +1/3    (Slightly Pleasant)
 *     5 → +1      (Very Pleasant)
 *
 * The tempting `(mood − 3) / 2` is WRONG here. It yields ±0.5, which falls
 * exactly between two stops; rounding sends both halves upward, so mood 2 became
 * "Slightly Unpleasant" while mood 4 became "Pleasant" — one stop further from
 * neutral than its mirror. Every historical average would have tilted upward.
 *
 * ── WHY THIS IS DUPLICATED ──────────────────────────────────────────────────
 * The same table lives in services/gozlin/mind.ts as `valenceFromLegacyMood`,
 * and this is a deliberate copy, not an oversight: health-os/platform imports
 * nothing from any domain (see platform/index.ts), and a migration that reached
 * into services/ would invert that dependency. The two are pinned together by a
 * test — see health-os/__tests__/migration004.test.ts — so they cannot drift.
 */
const STOP_VALENCE: Record<number, number> = {
  1: -1,
  2: -1 / 3,
  3: 0,
  4: 1 / 3,
  5: 1,
};

function valenceFromLegacyMood(mood: number): number {
  const v = STOP_VALENCE[Math.round(mood)];
  return v === undefined ? 0 : v;
}

export const migration004: Migration = {
  version: 4,
  name: "mind-valence",

  async up({ store }): Promise<MigrationReport> {
    const list = await store.get<StoredCheckin[] | null>(LEGACY.GOZLIN_CHECKINS, null);

    if (!Array.isArray(list) || list.length === 0) {
      return { migrated: 0, reason: "no-checkins" };
    }

    let converted = 0;
    let stamped = 0;
    let skipped = 0;

    const next = list.map((c) => {
      if (!c || typeof c !== "object" || typeof c.date !== "string") return c;

      // Already on the new scale — a re-run must not touch it.
      if (typeof c.valence === "number") {
        skipped += 1;
        return c;
      }

      // Every pre-004 record was a day's check-in; there was no other kind.
      const out: StoredCheckin = {
        ...c,
        id: c.id ?? `daily:${c.date}`,
        kind: c.kind ?? "daily",
      };

      if (typeof c.mood === "number" && Number.isFinite(c.mood)) {
        out.valence = valenceFromLegacyMood(c.mood);
        converted += 1;
      } else {
        // A sleep-only check-in. It gets an identity, not a feeling.
        stamped += 1;
      }

      return out;
    });

    await store.set(LEGACY.GOZLIN_CHECKINS, next);

    // Read back and assert, so a storage failure fails the migration loudly
    // instead of advancing the version over records that never changed.
    const after = await store.get<StoredCheckin[] | null>(
      LEGACY.GOZLIN_CHECKINS,
      null,
    );
    if (!Array.isArray(after) || after.length !== list.length) {
      throw new Error(
        `valence remap did not persist: expected ${list.length} records, got ${
          Array.isArray(after) ? after.length : "none"
        }`,
      );
    }
    // Count only the records this migration set out to convert. A malformed
    // entry — null, or missing its date — is SKIPPED by the map above, so it
    // still holds a bare `mood` afterwards and must not be counted as a failure.
    // Counting it would make one junk record throw on every launch, which leaves
    // schema_version pinned below 4 forever and silently blocks every future
    // migration behind it. A stuck chain is far worse than an unconverted row.
    const unconverted = after.filter(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof c.date === "string" &&
        typeof c.mood === "number" &&
        c.valence == null,
    ).length;
    if (unconverted > 0) {
      throw new Error(`valence remap left ${unconverted} mood record(s) unconverted`);
    }

    return { migrated: converted, stamped, skipped, total: list.length };
  },
};
