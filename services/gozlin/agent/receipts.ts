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
 * can — a figure a model computed has no provenance to show. welliva's coach is
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
  /**
   * What the number is ABOUT, when the payload names it: the habit, exercise,
   * metric or domain the enclosing object describes. Without it a habit
   * tracker's "12" reads as "Streak" — whose streak? — and five habits' figures
   * are indistinguishable on the sheet.
   */
  subject?: string;
}

/**
 * A memory a reply used — "YOU TOLD ME · 12 SEP" under the bubble.
 *
 * Grounding and the trail above are about NUMBERS; a recall like "on 12 Sep
 * you said your hamstrings were wrecked" has none, so it would get no receipt
 * at all. This is the receipt for a quote.
 *
 * It carries the record's id, its name and its date — NEVER their words. The
 * sheet reads the words from the live store by id, so forgetting a memory also
 * empties every receipt that pointed at it, instead of leaving a copy of what
 * they asked to forget inside an old conversation.
 */
export interface RecallReceipt {
  recordId: string;
  label: string;
  /** YYYY-MM-DD — when they tried it, or when they told us. */
  on: string;
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
  // The same spoken forms grounding registers — magnitude, percentage — so a
  // figure grounding accepts by one of them finds its receipt by the same one.
  const keys = new Set<number>();
  for (const f of spokenForms(source.value)) {
    keys.add(f);
    keys.add(Math.round(f));
    keys.add(Math.round(f * 10) / 10);
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
import { extractNumbers, isProseNumber, matchesEvidence, spokenForms } from "./grounding";

/**
 * Fields that NAME the thing an object describes, in order of preference. The
 * first string one found becomes the `subject` of every number beneath it.
 */
const SUBJECT_KEYS = ["name", "exercise", "label", "title", "domain", "slot", "food"] as const;

function subjectOf(obj: Record<string, unknown>): string | undefined {
  for (const k of SUBJECT_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

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

  const visit = (v: unknown, path: string, depth: number, subject?: string): void => {
    if (v == null || depth > 12) return;
    const at = (value: number): NumberSource =>
      subject ? { origin, path, value, subject } : { origin, path, value };

    if (typeof v === "number") {
      if (Number.isFinite(v)) register(ledger, at(v));
      return;
    }
    if (typeof v === "string") {
      for (const n of extractNumbers(v)) register(ledger, at(n));
      return;
    }
    if (typeof v !== "object") return;

    // Cycles are not expected in tool JSON, but a guard costs one WeakSet.
    if (seen.has(v as object)) return;
    seen.add(v as object);

    if (Array.isArray(v)) {
      v.forEach((item, i) => visit(item, `${path}[${i}]`, depth + 1, subject));
      return;
    }
    const obj = v as Record<string, unknown>;
    const named = subjectOf(obj) ?? subject;
    for (const [k, item] of Object.entries(obj)) {
      visit(item, path ? `${path}.${k}` : k, depth + 1, named);
    }
  };

  visit(evidence, "", 0);
  return ledger;
}

/**
 * Best sources for one figure: exact key first, then grounding's own rounding
 * test — the same `matchesEvidence` grounding.ts accepts with, so a receipt
 * exists for anything it passed and for nothing it would have rejected.
 */
export function sourcesFor(n: number, ledger: NumberLedger): NumberSource[] {
  const exact = ledger.byKey.get(n);
  if (exact && exact.length > 0) return dedupe(exact);
  return dedupe(ledger.all.filter((s) => matchesEvidence(n, s.value)));
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
    // Small integers are prose, not measurements — grounding skips them, so do we.
    if (isProseNumber(n)) continue;
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
  // The block every turn carries — today's intake, but also the streak,
  // recovery and latest weigh-in, so "Today's totals" undersold it.
  "current-state": "Your logs, right now",
  "habit-tracker": "Your habit tracker",
  investigate_progress: "Your progress history",
  analyze_nutrition: "Your food log",
  analyze_training: "Your training log",
  get_weekly_review: "This week's review",
  get_forecast: "Your forecast",
  get_habit_report: "Your habit history",
  review_tracked_habits: "Your habit tracker",
  review_mood_log: "Your mood log",
  get_recovery_status: "Your recovery signals",
  get_daily_briefing: "Today's briefing",
  recall_memory: "What you've told me",
  log_food: "What was just logged",
  // Something new they did, and what they said about things they tried.
  "experience-log": "What you told me about trying things",
  note_experience: "What you just told me",
};

export function originLabel(origin: string): string {
  return ORIGIN_LABEL[origin] ?? origin.split("_").join(" ");
}

/**
 * Path → a readable field name.
 *
 * THESE ARE THE REAL PATHS. The table used to be keyed to the shape of a test
 * fixture (`today.calories`, `streak.current`) that the live twin never had —
 * its paths are `today.calories.consumed`, `momentum.streak` — so in the app
 * every receipt fell through to the leaf and read "Consumed" or "Target", with
 * nothing to say target of WHAT. The fixture keys stay, because the fixture
 * still exists; the live ones are what users see.
 */
const PATH_LABEL: Record<string, string> = {
  // Live twin (services/gozlin/GozlinTwin.ts).
  "today.calories.consumed": "Calories eaten today",
  "today.calories.target": "Daily calorie target",
  "today.calories.pct": "Share of calorie target",
  "today.protein.consumed": "Protein eaten today (g)",
  "today.protein.target": "Daily protein target (g)",
  "today.protein.pct": "Share of protein target",
  "today.water.consumed": "Water today (ml)",
  "today.water.target": "Daily water goal (ml)",
  "today.water.pct": "Share of water goal",
  "today.workout.minutes": "Today's session length (min)",
  "today.dayProgress": "How far through the day",
  "momentum.streak": "Current streak (days)",
  "momentum.adherence7d": "7-day adherence score",
  "momentum.trainingLoad7d": "Sessions in the last 7 days",
  "recovery.score": "Recovery score",
  "body.currentWeightKg": "Latest weigh-in (kg)",
  "body.startWeightKg": "Starting weight (kg)",
  "body.goalWeightKg": "Goal weight (kg)",
  "body.measuredRatePerWeek": "Measured change per week (kg)",
  "body.trendFit": "How well the trend fits your weigh-ins",
  "body.weighIns": "Weigh-ins in the trend",
  "body.goalProgress": "Progress to your goal",
  // Derived gaps the agent loop registers alongside the twin.
  "today.calories.left": "Calories left today",
  "today.calories.over": "Calories over target",
  "today.protein.left": "Protein left today (g)",
  "today.protein.over": "Protein over target (g)",
  "today.water.left": "Water left today (ml)",
  "today.water.over": "Water over goal (ml)",
  // The fixture shape (services/gozlin/agent/__tests__/receipts.test.ts).
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

/**
 * Leaf field → label, for tool results, whose paths vary with array positions.
 * Checked after the full-path table and before the humanised fallback.
 */
const LEAF_LABEL: Record<string, string> = {
  ratePerWeekKg: "Change per week (kg)",
  currentWeightKg: "Latest weigh-in (kg)",
  goalWeightKg: "Goal weight (kg)",
  etaWeeks: "Weeks to goal",
  successScore: "Likelihood of success (0–100)",
  overallScore: "Overall habit score",
  adherence: "Adherence score",
  last30Pct: "Done in the last 30 days (%)",
  daysDone: "Days done",
  daysSinceStopped: "Days since stopping",
  skips: "Times skipped",
  served: "Times served",
  sessions: "Sessions",
  dayCount: "Day of your journey",
  proteinG: "Protein (g)",
  calories: "Calories",
  quantity: "Amount",
  averageValence: "Average mood",
  entries: "Mood check-ins",
  sessionsBefore: "Sessions logged before you first did it",
  daysAgo: "Days since you tried it",
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
  if (LEAF_LABEL[leaf]) return LEAF_LABEL[leaf];
  // camelCase / snake_case → sentence case.
  const spaced = leaf
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The full field label for one source: what it is ABOUT, then which field.
 * "Reading — Streak" rather than a bare "Streak" that five habits share.
 */
export function sourceLabel(source: NumberSource): string {
  const field = pathLabel(source.path);
  return source.subject ? `${source.subject} — ${field}` : field;
}

/**
 * How the spoken figure relates to the stored one, when they differ. Rounding
 * is not the only honest difference: a stored −0.4 is said "0.4 down", and a
 * stored 0.72 is said "72%". Calling either "rounded" would be its own small lie.
 */
export function howSpoken(shown: number, value: number): string {
  const mag = Math.abs(value);
  if (mag > 0 && mag <= 1 && Math.abs(shown) > 1) return "said as a percentage";
  if (value < 0 && shown > 0) return "said without its sign";
  return "rounded for speech";
}
