/**
 * GOZLIN AGENT — receipts.
 *
 * Grounding already proves every figure in a reply came from real evidence. It
 * then throws that proof away: `collectAllowedNumbers` flattens the twin state
 * and every tool result into a bare `Set<number>`, checks the reply against it,
 * and discards which piece of evidence backed which number.
 *
 * This module keeps the proof. Same walk, same rounding rules, but each value
 * is recorded WITH where it came from — so when the coach says "you're 340
 * calories short", the app can show that 340 came from `analyze_nutrition`'s
 * `gap.calories` field, counted from today's log.
 *
 * WHY THIS IS THE PRODUCT, NOT A DEBUG VIEW. Every health app will tell you a
 * number. None of them will tell you where it came from, because none of them
 * can — a figure a model computed has no provenance to show. Welliva's coach is
 * contractually forbidden from computing figures (see ./context.ts), which is
 * exactly what makes a receipt possible. The architecture was already paid for;
 * this renders the receipt it was buying.
 *
 * THE LEDGER MIRRORS `add()` IN grounding.ts. One evidence value registers
 * several keys — itself, its integer rounding, its one-decimal rounding, and
 * the percentage a rate is naturally voiced as. Every one of those keys must
 * point back at the SAME source, or a coach who says "72%" for a stored 0.7156
 * gets no receipt. If grounding's rounding rules change, they change here too;
 * the shared test in __tests__/receipts.test.ts pins them together.
 */

/** Where a single number came from. */
export interface NumberSource {
  /**
   * The evidence block that carried it — a tool name (`analyze_nutrition`) or
   * `current-state` for the twin block appended to every turn.
   */
  origin: string;
  /** Dotted path inside that payload, e.g. `today.calories`. */
  path: string;
  /** The value exactly as the evidence carried it, before any rounding. */
  value: number;
}

/** One number in a reply, and the evidence behind it. */
export interface Receipt {
  /** The figure as the coach wrote it. */
  shown: number;
  /**
   * Everything that could back it, best match first. Usually one entry; more
   * when the same figure appears in several places (a total that is also a
   * field on the twin), which is itself worth showing.
   */
  sources: NumberSource[];
}

/**
 * The provenance index built alongside grounding's allowed-set.
 *
 * `byKey` is keyed on the ROUNDED forms a number may be spoken as, so lookup is
 * O(1) for the common case; `all` keeps insertion order for the tolerance
 * fallback, which has to scan.
 */
export interface NumberLedger {
  byKey: Map<number, NumberSource[]>;
  all: NumberSource[];
}

export function createLedger(): NumberLedger {
  return { byKey: new Map(), all: [] };
}

/** Register one source under every key it could legitimately be spoken as. */
function register(ledger: NumberLedger, source: NumberSource): void {
  const n = source.value;
  const keys = new Set<number>([n, Math.round(n), Math.round(n * 10) / 10]);
  // Rates and fractions are routinely voiced as percentages — mirrors grounding.
  if (Math.abs(n) <= 1) {
    keys.add(Math.round(n * 100));
    keys.add(Math.round(n * 1000) / 10);
  }
  for (const k of keys) {
    if (!Number.isFinite(k)) continue;
    const list = ledger.byKey.get(k);
    if (list) list.push(source);
    else ledger.byKey.set(k, [source]);
  }
  ledger.all.push(source);
}

/**
 * Numbers embedded in evidence STRINGS keep the string's own path — engine
 * payloads carry pre-formatted copy ("trending 0.4 kg/week down") and those
 * figures are citable, so they need a receipt too.
 */
import { extractNumbers } from "./grounding";

/**
 * Walk an evidence payload, recording every number with its path.
 *
 * `origin` labels the whole payload — a tool name, or `current-state`. Depth is
 * capped because tool results are app-shaped data, not arbitrary user input,
 * and an unbounded walk over a cyclic structure would hang the turn.
 */
export function collectWithProvenance(
  evidence: unknown,
  origin: string,
  ledger: NumberLedger,
): NumberLedger {
  const seen = new WeakSet<object>();

  const visit = (v: unknown, path: string, depth: number): void => {
    if (v == null || depth > 12) return;

    if (typeof v === "number") {
      if (Number.isFinite(v)) register(ledger, { origin, path, value: v });
      return;
    }
    if (typeof v === "string") {
      for (const n of extractNumbers(v)) {
        register(ledger, { origin, path, value: n });
      }
      return;
    }
    if (typeof v !== "object") return;

    // Cycles are not expected in tool JSON, but a guard costs one WeakSet.
    if (seen.has(v as object)) return;
    seen.add(v as object);

    if (Array.isArray(v)) {
      v.forEach((item, i) => visit(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      visit(item, path ? `${path}.${k}` : k, depth + 1);
    }
  };

  visit(evidence, "", 0);
  return ledger;
}

/** Same tolerance grounding accepts, so a receipt exists for anything it passed. */
const RELATIVE_TOLERANCE = 0.02;
const ABSOLUTE_TOLERANCE = 1;

/** Small integers are prose, not measurements — grounding skips them, so do we. */
const SMALL_INTEGER_CEILING = 10;

/** Best sources for one figure: exact key first, then grounding's tolerance. */
export function sourcesFor(n: number, ledger: NumberLedger): NumberSource[] {
  const exact = ledger.byKey.get(n);
  if (exact && exact.length > 0) return dedupe(exact);

  const tolerance = Math.max(ABSOLUTE_TOLERANCE, Math.abs(n) * RELATIVE_TOLERANCE);
  const near = ledger.all.filter((s) => Math.abs(s.value - n) <= tolerance);
  return dedupe(near);
}

/** One entry per origin+path; the same field re-registered under several keys
 *  must not show up as several receipts for the same fact. */
function dedupe(sources: NumberSource[]): NumberSource[] {
  const out: NumberSource[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const k = `${s.origin}|${s.path}|${s.value}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * Build the receipt list for a finished reply.
 *
 * Only figures that actually have evidence get a receipt. A number with no
 * source is not rendered as tappable — grounding should already have caught it
 * and regenerated, and offering an empty receipt would be worse than offering
 * none: it invites a tap that answers nothing.
 */
export function receiptsFor(reply: string, ledger: NumberLedger): Receipt[] {
  const out: Receipt[] = [];
  const seen = new Set<number>();

  for (const n of extractNumbers(reply)) {
    if (Number.isInteger(n) && n <= SMALL_INTEGER_CEILING) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    const sources = sourcesFor(n, ledger);
    if (sources.length > 0) out.push({ shown: n, sources });
  }
  return out;
}

/* ────────────────────────── Human phrasing ──────────────────────────── */

/**
 * Tool name → what the user should be told it read. The coach's tools are named
 * for the model, not for a person: "investigate_progress" is a fine tool name
 * and a terrible sentence.
 */
const ORIGIN_LABEL: Record<string, string> = {
  "current-state": "Today's totals",
  investigate_progress: "Your progress history",
  analyze_nutrition: "Your food log",
  analyze_training: "Your training log",
  get_weekly_review: "This week's review",
  get_forecast: "Your forecast",
  get_habit_report: "Your habit history",
  get_recovery_status: "Your recovery signals",
  get_daily_briefing: "Today's briefing",
  recall_memory: "What you've told me",
};

export function originLabel(origin: string): string {
  return ORIGIN_LABEL[origin] ?? origin.split("_").join(" ");
}

/**
 * Path → a readable field name. Falls back to humanising the dotted path, which
 * is why unknown fields still render acceptably instead of leaking `[0].x`.
 */
const PATH_LABEL: Record<string, string> = {
  "today.calories": "Calories logged today",
  "today.protein": "Protein logged today",
  "today.water": "Water logged today",
  "today.caloriesTarget": "Your calorie target",
  "today.proteinTarget": "Your protein target",
  "streak.current": "Current streak",
  "streak.longest": "Longest streak",
  "weight.current": "Latest weigh-in",
  "weight.change": "Weight change",
};

export function pathLabel(path: string): string {
  const known = PATH_LABEL[path];
  if (known) return known;
  const leaf = path
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .pop();
  if (!leaf) return "Logged value";
  // camelCase / snake_case → sentence case.
  const spaced = leaf
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
