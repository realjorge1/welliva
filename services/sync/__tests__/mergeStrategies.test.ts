/**
 * MERGE STRATEGIES — the properties, then the scenario that motivated them.
 *
 * The properties matter more than the examples. A merge function that's correct
 * on the cases you thought of and asymmetric on the ones you didn't will lose
 * data in the field and pass its own tests, so commutativity and idempotence are
 * checked exhaustively across every strategy in the registry.
 */
import { describe, expect, it } from "vitest";

import { KEYS } from "../../OfflineStorage";
import {
  MERGE_STRATEGIES,
  isMergeable,
  merge,
  strategyFor,
  unionById,
} from "../mergeStrategies";

const SESSION_HISTORY = "@welliva_session_history";

/** Compare as a SET, so "commutative" doesn't secretly demand equal ordering. */
const asSet = (json: string | null): unknown => {
  if (json === null) return null;
  const parsed = JSON.parse(json);
  if (Array.isArray(parsed)) {
    return [...parsed].map((x) => JSON.stringify(x)).sort();
  }
  return parsed;
};

/* ─────────────────────── the scenario from the audit ───────────────────────*/

describe("breakfast on the phone, lunch on the tablet", () => {
  const phone = JSON.stringify({
    "2026-07-20": [
      { id: "a", label: "Oats", loggedAt: "2026-07-20T07:30:00Z" },
    ],
  });
  const tablet = JSON.stringify({
    "2026-07-20": [
      { id: "b", label: "Salad", loggedAt: "2026-07-20T12:30:00Z" },
    ],
  });

  it("keeps BOTH meals — the whole point of this module", () => {
    const merged = JSON.parse(merge(KEYS.FOOD_LOG, phone, tablet)!);
    const ids = merged["2026-07-20"].map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("used to lose one of them — remote simply won", () => {
    // What last-write-wins did, kept as the contrast this fix exists for.
    const lww = JSON.parse(tablet);
    expect(lww["2026-07-20"]).toHaveLength(1);
  });

  it("keeps days that only one device has", () => {
    const a = JSON.stringify({ "2026-07-19": [{ id: "x", loggedAt: "1" }] });
    const b = JSON.stringify({ "2026-07-20": [{ id: "y", loggedAt: "2" }] });
    const merged = JSON.parse(merge(KEYS.FOOD_LOG, a, b)!);
    expect(Object.keys(merged).sort()).toEqual(["2026-07-19", "2026-07-20"]);
  });

  it("unions a whole offline week against a whole online week", () => {
    const offline: Record<string, unknown[]> = {};
    const online: Record<string, unknown[]> = {};
    for (let d = 1; d <= 7; d += 1) {
      const date = `2026-07-0${d}`;
      offline[date] = [{ id: `off${d}`, loggedAt: `${date}T08:00:00Z` }];
      online[date] = [{ id: `on${d}`, loggedAt: `${date}T18:00:00Z` }];
    }
    const merged = JSON.parse(
      merge(KEYS.FOOD_LOG, JSON.stringify(offline), JSON.stringify(online))!,
    );
    expect(Object.keys(merged)).toHaveLength(7);
    for (const entries of Object.values(merged)) {
      expect(entries as unknown[]).toHaveLength(2);
    }
  });
});

/* ────────────────────────────── the properties ─────────────────────────────*/

/** A realistic pair of documents for each strategy in the registry. */
const FIXTURES: Record<string, [string, string]> = {
  [KEYS.FOOD_LOG]: [
    JSON.stringify({
      "2026-07-01": [{ id: "a", loggedAt: "2026-07-01T08:00:00Z" }],
      "2026-07-02": [{ id: "b", loggedAt: "2026-07-02T08:00:00Z" }],
    }),
    JSON.stringify({
      "2026-07-02": [{ id: "c", loggedAt: "2026-07-02T19:00:00Z" }],
      "2026-07-03": [{ id: "d", loggedAt: "2026-07-03T08:00:00Z" }],
    }),
  ],
  [KEYS.WATER_HISTORY]: [
    JSON.stringify([
      { date: "2026-07-01", ml: 1500 },
      { date: "2026-07-02", ml: 2000 },
    ]),
    JSON.stringify([
      { date: "2026-07-02", ml: 2500, goalMl: 2500 },
      { date: "2026-07-03", ml: 1000 },
    ]),
  ],
  [KEYS.DIET_HISTORY]: [
    JSON.stringify([{ date: "2026-07-02", dietId: "x", mealsConsumed: 2 }]),
    JSON.stringify([
      { date: "2026-07-03", dietId: "x", mealsConsumed: 3 },
      { date: "2026-07-01", dietId: "x", mealsConsumed: 1 },
    ]),
  ],
  [KEYS.BODY_LOGS]: [
    JSON.stringify([{ date: "2026-07-01", weightKg: 80 }]),
    JSON.stringify([
      { date: "2026-07-01", weightKg: 80.5 },
      { date: "2026-07-05", weightKg: 79.8 },
    ]),
  ],
  [KEYS.WORKOUT_LOGS]: [
    JSON.stringify([{ id: "w1", completedAt: "2026-07-01T10:00:00Z" }]),
    JSON.stringify([{ id: "w2", completedAt: "2026-07-02T10:00:00Z" }]),
  ],
  [SESSION_HISTORY]: [
    JSON.stringify([{ sessionRunId: "s1", completedAt: "2026-07-01T10:00:00Z" }]),
    JSON.stringify([
      { sessionRunId: "s1", completedAt: "2026-07-01T10:00:00Z" },
      { sessionRunId: "s2", completedAt: "2026-07-02T10:00:00Z" },
    ]),
  ],
  [KEYS.MEAL_PLAN_PERIODS]: [
    JSON.stringify([{ id: "p1", createdAt: "2026-06-01T00:00:00Z" }]),
    JSON.stringify([{ id: "p2", createdAt: "2026-07-01T00:00:00Z" }]),
  ],
  [KEYS.NUTRITION_HISTORY]: [
    JSON.stringify([{ date: "2026-07-01", calories: 2000, mealsLogged: 3 }]),
    JSON.stringify([{ date: "2026-07-02", calories: 2100, mealsLogged: 2 }]),
  ],
  [KEYS.EXERCISE_HISTORY]: [
    JSON.stringify([{ date: "2026-07-01", minutes: 30 }]),
    JSON.stringify([{ date: "2026-07-02", minutes: 45 }]),
  ],
};

describe("every registered strategy has a fixture", () => {
  it("covers the whole registry", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(Object.keys(MERGE_STRATEGIES).sort());
  });
});

describe("properties", () => {
  for (const [key, [a, b]] of Object.entries(FIXTURES)) {
    it(`${key} is commutative`, () => {
      expect(asSet(merge(key, a, b))).toEqual(asSet(merge(key, b, a)));
    });

    it(`${key} is idempotent`, () => {
      const once = merge(key, a, b);
      expect(merge(key, once, b)).toEqual(once);
      expect(merge(key, once, once)).toEqual(once);
    });

    it(`${key} never drops an item present on either side`, () => {
      const merged = merge(key, a, b)!;
      for (const side of [a, b]) {
        const parsed = JSON.parse(side);
        const ids = Array.isArray(parsed)
          ? parsed.map((x: Record<string, unknown>) =>
              String(x.id ?? x.sessionRunId ?? x.date),
            )
          : Object.keys(parsed);
        for (const id of ids) expect(merged).toContain(id);
      }
    });
  }
});

/* ─────────────────────────── degrading safely ──────────────────────────────*/

describe("degrades to today's behavior rather than throwing", () => {
  it("falls back to remote on unparseable JSON", () => {
    expect(merge(KEYS.FOOD_LOG, "{not json", '{"a":1}')).toBe('{"a":1}');
  });

  it("falls back to remote when the real shape isn't what the strategy expects", () => {
    // An array where a Record<date, …> was declared.
    expect(merge(KEYS.FOOD_LOG, "[1,2,3]", '{"2026-07-01":[]}')).toBe(
      '{"2026-07-01":[]}',
    );
  });

  it("treats a missing local document as 'adopt remote'", () => {
    expect(merge(KEYS.FOOD_LOG, null, '{"a":[]}')).toBe('{"a":[]}');
  });

  it("treats a tombstone as a deletion, not a merge", () => {
    expect(merge(KEYS.FOOD_LOG, '{"a":[]}', null)).toBeNull();
  });

  it("leaves single-valued documents on last-write-wins", () => {
    expect(isMergeable(KEYS.USER_BIO)).toBe(false);
    expect(strategyFor(KEYS.USER_BIO).kind).toBe("lww");
    expect(merge(KEYS.USER_BIO, '{"age":30}', '{"age":31}')).toBe('{"age":31}');
  });
});

/* ─────────────────── the identity-field trap, pinned ───────────────────────*/

describe("identity", () => {
  it("UNIONS items whose id field is missing instead of collapsing them", () => {
    // The failure this guards: name a field the data doesn't have and every
    // item keys on `undefined`, so a 200-item array merges down to ONE. That
    // would destroy data far more efficiently than the LWW it replaced.
    const a = [{ foo: 1 }, { foo: 2 }];
    const b = [{ foo: 3 }];
    expect(unionById(a, b, "nonexistent")).toHaveLength(3);
  });

  it("resolves a same-id collision toward the newer timestamp", () => {
    const older = { id: "x", completedAt: "2026-07-01T00:00:00Z", reps: 8 };
    const newer = { id: "x", completedAt: "2026-07-02T00:00:00Z", reps: 12 };
    expect(unionById([older], [newer], "id", "completedAt")).toEqual([newer]);
    // …and the same answer whichever side it arrives from.
    expect(unionById([newer], [older], "id", "completedAt")).toEqual([newer]);
  });

  it("caps to the newest N without disturbing the array's own order", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    }));
    const asc = unionById(rows, [], "date", "date", "asc", 3);
    expect(asc.map((r) => (r as { date: string }).date)).toEqual([
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);

    const desc = unionById(rows, [], "date", "date", "desc", 3);
    expect(desc.map((r) => (r as { date: string }).date)).toEqual([
      "2026-07-10",
      "2026-07-09",
      "2026-07-08",
    ]);
  });

  it("field names match the real models, not plausible-looking guesses", () => {
    // These are the ones an audit table got wrong: body logs have no `id`,
    // sessions use `sessionRunId`/`completedAt`, not `id`/`endedAt`.
    expect(strategyFor(KEYS.BODY_LOGS)).toMatchObject({ idField: "date" });
    expect(strategyFor(SESSION_HISTORY)).toMatchObject({
      idField: "sessionRunId",
      tsField: "completedAt",
    });
    expect(strategyFor(KEYS.WORKOUT_LOGS)).toMatchObject({
      idField: "id",
      tsField: "completedAt",
    });
  });
});
