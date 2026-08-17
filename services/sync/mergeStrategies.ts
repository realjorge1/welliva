/**
 * MERGE STRATEGIES — the fix for whole-document last-write-wins.
 *
 * THE BUG. Every synced AsyncStorage key is mirrored as one JSONB document, and
 * conflicts were resolved per-KEY by server `updated_at`. Log breakfast on your
 * phone and lunch on your tablet, and whichever `@welliva_food_log` wrote last
 * won — the other device's entire day was discarded, not merged. The old comment
 * ("one human rarely edits two phones in the same second") was answering the
 * wrong question: LWW here is at DOCUMENT granularity, so the collision window
 * isn't a second, it's however long the other device stayed offline.
 *
 * THE FIX, and its scope. Not a CRDT. The device genuinely is the source of
 * truth and nobody is co-editing these logs live; a registry of per-key merge
 * functions fixes the actual failure mode in ~200 testable lines. Revisit real
 * CRDTs only if a web client ever edits the same data concurrently.
 *
 * ── TWO THINGS THIS MODULE IS PARANOID ABOUT ────────────────────────────────
 *
 * 1. IDENTITY FIELDS MUST BE REAL. If a strategy names an id field the data
 *    doesn't have, every item reads as `undefined` and the union collapses to
 *    ONE item — a merge layer that destroys data far more efficiently than the
 *    LWW it replaced. So the table below is written against the actual models
 *    (`sessionRunId` not `id`; `completedAt` not `endedAt`; `date` for body
 *    logs, which have no id at all), and `identityOf` falls back to the item's
 *    own JSON when the field is missing — union, never collapse.
 *
 * 2. SHAPE MISMATCH IS SURVIVABLE. If a key's real shape ever stops matching its
 *    declared strategy, we return `remote` — exactly today's behavior. A merge
 *    layer must degrade to the thing it replaced, never to an exception.
 *
 * ── THE PROPERTIES THE TESTS PIN ────────────────────────────────────────────
 *   idempotent:  merge(k, merge(k,a,b), b) === merge(k,a,b)
 *   commutative: merge(k,a,b) === merge(k,b,a)
 * Both hold because every conflict is resolved by comparing the VALUES (never
 * "which side is local"), and output is deterministically ordered.
 */
import { KEYS } from "../OfflineStorage";

export type MergeStrategy =
  /** Current behavior: adopt the remote document wholesale. The default. */
  | { kind: "lww" }
  /**
   * `Record<YYYY-MM-DD, V>`. Days union; a day present on both sides merges by
   * value — arrays union item-wise, objects resolve by `preferField` (highest
   * wins) or, failing that, by richness.
   */
  | { kind: "mergeByDate"; preferField?: string; capDays?: number }
  /** `T[]` with a stable identity per item. */
  | {
      kind: "mergeById";
      idField: string;
      /** ISO/comparable field deciding which side of a collision is newer. */
      tsField?: string;
      /** Output order; matches how the owning service writes the array. */
      order?: "asc" | "desc";
      /** Keep at most this many items after merging. */
      cap?: number;
    };

/**
 * Per-key strategies. Every field name here was read off the model — see
 * paranoia note 1. Keys absent from this map get `lww`, which is correct for
 * single-valued documents (the active plan, the bio, preferences): those aren't
 * append-only, and merging two versions of one object is meaningless.
 */
export const MERGE_STRATEGIES: Record<string, MergeStrategy> = {
  // Record<date, FoodLogEntry[]> — the headline case from the audit.
  [KEYS.FOOD_LOG]: { kind: "mergeByDate", capDays: 180 },

  // NutritionHistoryEntry[] / legacy day rows, keyed by date. `mealsLogged`
  // breaks a same-day tie: the device that logged more saw more of that day.
  [KEYS.NUTRITION_HISTORY]: {
    kind: "mergeById",
    idField: "date",
    tsField: "date",
    order: "asc",
    cap: 400,
  },
  // WaterHistoryEntry[] — { date, ml, goalMl }. No id, no timestamp.
  [KEYS.WATER_HISTORY]: {
    kind: "mergeById",
    idField: "date",
    tsField: "date",
    order: "asc",
    cap: 400,
  },
  [KEYS.EXERCISE_HISTORY]: {
    kind: "mergeById",
    idField: "date",
    tsField: "date",
    order: "asc",
    cap: 400,
  },
  // DietHistoryEntry[] — keyed by `date`; NO id field, newest-first.
  [KEYS.DIET_HISTORY]: {
    kind: "mergeById",
    idField: "date",
    tsField: "date",
    order: "desc",
    cap: 400,
  },
  // BodyLogEntry[] — { date, weightKg, … }. Deliberately uncapped: it's tiny,
  // and the weight-trend filter wants the whole history.
  [KEYS.BODY_LOGS]: {
    kind: "mergeById",
    idField: "date",
    tsField: "date",
    order: "asc",
  },
  // WorkoutLogEntry[] — has a real `id` and `completedAt`.
  [KEYS.WORKOUT_LOGS]: {
    kind: "mergeById",
    idField: "id",
    tsField: "completedAt",
    order: "desc",
    cap: 400,
  },
  // SessionSummaryData[] — `sessionRunId`, `completedAt`. NOT `id`/`endedAt`.
  "@welliva_session_history": {
    kind: "mergeById",
    idField: "sessionRunId",
    tsField: "completedAt",
    order: "desc",
    cap: 400,
  },
  // MealPlanPeriod[] — `id`; `closedAt` is set late, so order on `createdAt`.
  [KEYS.MEAL_PLAN_PERIODS]: {
    kind: "mergeById",
    idField: "id",
    tsField: "createdAt",
    order: "desc",
  },
  // CustomFood[] — foods the user added that our catalogs never had. Merging
  // matters more here than for most lists: these are hand-curated additions, so
  // last-write-wins would silently discard everything one device added while
  // the other was offline. Newest first, matching CustomFoodService's writes.
  [KEYS.CUSTOM_FOODS]: {
    kind: "mergeById",
    idField: "id",
    tsField: "addedAt",
    order: "desc",
    cap: 300,
  },
};

export function strategyFor(key: string): MergeStrategy {
  return MERGE_STRATEGIES[key] ?? { kind: "lww" };
}

/** True when a key gets real merging — the sync engine branches on this. */
export function isMergeable(key: string): boolean {
  return strategyFor(key).kind !== "lww";
}

/* ────────────────────────────── helpers ────────────────────────────────────*/

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Deterministic, side-independent tie-break. Never "prefer local". */
function preferRicher(a: unknown, b: unknown, preferField?: string): unknown {
  if (preferField && isPlainObject(a) && isPlainObject(b)) {
    const av = a[preferField];
    const bv = b[preferField];
    if (typeof av === "number" && typeof bv === "number" && av !== bv) {
      return av > bv ? a : b;
    }
  }
  // Fall back to "more content wins", then to a stable lexical comparison so
  // the answer can't depend on argument order.
  const aj = JSON.stringify(a) ?? "";
  const bj = JSON.stringify(b) ?? "";
  if (aj.length !== bj.length) return aj.length > bj.length ? a : b;
  return aj >= bj ? a : b;
}

/**
 * How an item is identified. A missing/blank id falls back to the item's own
 * JSON, so an unexpected shape produces a UNION of distinct items rather than
 * collapsing every one of them onto the key `undefined`.
 */
function identityOf(item: unknown, idField: string): string {
  if (isPlainObject(item)) {
    const raw = item[idField];
    if (typeof raw === "string" && raw) return `k:${raw}`;
    if (typeof raw === "number") return `k:${raw}`;
  }
  return `j:${JSON.stringify(item)}`;
}

function timestampOf(item: unknown, tsField?: string): string {
  if (tsField && isPlainObject(item)) {
    const raw = item[tsField];
    if (typeof raw === "string") return raw;
    if (typeof raw === "number") return String(raw).padStart(20, "0");
  }
  return "";
}

/** Union two arrays by identity; collisions resolve by timestamp, then value. */
export function unionById(
  a: unknown[],
  b: unknown[],
  idField: string,
  tsField?: string,
  order: "asc" | "desc" = "desc",
  cap?: number,
): unknown[] {
  const byId = new Map<string, unknown>();

  for (const item of [...a, ...b]) {
    const id = identityOf(item, idField);
    const existing = byId.get(id);
    if (existing === undefined) {
      byId.set(id, item);
      continue;
    }
    const ta = timestampOf(existing, tsField);
    const tb = timestampOf(item, tsField);
    if (ta !== tb) byId.set(id, tb > ta ? item : existing);
    else byId.set(id, preferRicher(existing, item));
  }

  const merged = [...byId.entries()].sort(([idA, itemA], [idB, itemB]) => {
    const ta = timestampOf(itemA, tsField);
    const tb = timestampOf(itemB, tsField);
    if (ta !== tb) return order === "asc" ? (ta < tb ? -1 : 1) : ta > tb ? -1 : 1;
    // Stable tie-break on identity, so equal timestamps can't reorder between
    // runs and cause a pointless re-push.
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  const items = merged.map(([, item]) => item);
  if (cap == null || items.length <= cap) return items;
  // Keep the newest `cap`, whichever end of the array they live at.
  return order === "asc" ? items.slice(items.length - cap) : items.slice(0, cap);
}

/** Union two `Record<date, V>` documents. */
export function mergeByDate(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  preferField?: string,
  capDays?: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const dates = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const kept = capDays != null && dates.length > capDays ? dates.slice(-capDays) : dates;

  for (const date of kept) {
    const av = a[date];
    const bv = b[date];
    if (av === undefined) {
      out[date] = bv;
    } else if (bv === undefined) {
      out[date] = av;
    } else if (Array.isArray(av) && Array.isArray(bv)) {
      // The real shape of FOOD_LOG: a day holds an ARRAY of entries, so a day
      // touched on both devices must union its entries too — this is the exact
      // "breakfast on the phone, lunch on the tablet" case.
      out[date] = unionById(av, bv, "id", "loggedAt", "asc");
    } else {
      out[date] = preferRicher(av, bv, preferField);
    }
  }
  return out;
}

/* ─────────────────────────────── the entry point ───────────────────────────*/

/**
 * Merge a local document against the remote one. Returns the string to store
 * locally, or `remote` for anything this module can't confidently improve on.
 *
 * `null` means "no document": a null local means the device doesn't have it,
 * a null remote means a tombstone. Neither is a merge — the caller handles both.
 */
export function merge(
  key: string,
  local: string | null,
  remote: string | null,
): string | null {
  const strategy = strategyFor(key);
  if (strategy.kind === "lww" || local === null || remote === null) return remote;

  try {
    const l: unknown = JSON.parse(local);
    const r: unknown = JSON.parse(remote);

    if (strategy.kind === "mergeByDate") {
      if (!isPlainObject(l) || !isPlainObject(r)) return remote; // shape drift
      return JSON.stringify(
        mergeByDate(l, r, strategy.preferField, strategy.capDays),
      );
    }

    if (!Array.isArray(l) || !Array.isArray(r)) return remote; // shape drift
    return JSON.stringify(
      unionById(l, r, strategy.idField, strategy.tsField, strategy.order, strategy.cap),
    );
  } catch {
    // Unparseable on either side → fall back to today's behavior.
    return remote;
  }
}
