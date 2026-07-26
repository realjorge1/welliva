/**
 * STORY SERVICE — long-horizon storytelling (Proactive Companion P6).
 *
 * Extends the proven MonthlyRecapService discipline (deterministic from real logs,
 * emoji-contained, archived) to the LONG horizons the monthly cadence can't tell:
 * the calendar year, a journey anniversary, a five-year arc, and a "documentary" of the
 * whole journey so far. Same rules: pure + deterministic (inject `now`), every number
 * traces to a persisted log (it reuses MonthlyRecapService's `RecapInput`), all copy lives
 * here, and emoji are contained behind a flag.
 *
 * Anniversaries also flow through the forward path: `ensureJourneyAnniversary` stamps a
 * recurring Life Context entry from `journeyStartedAt`, so the anticipation engine surfaces
 * it and the notification orchestrator can deliver it — one memory, many features.
 *
 * Home: `services/` (alongside MonthlyRecapService/JourneyService) so it can read both the
 * health-os archive store and GozlinPersona; the dependency rule forbids the reverse.
 * See docs/companion/00-proactive-companion-blueprint.md §3.5.
 */
import { store, K, type LifeContextRepository } from "@/health-os";
import { ACHIEVEMENTS, AchievementTier, TIER_META } from "./AchievementService";
import { celebrate, closer } from "./gozlin/GozlinPersona";
import { toLocalDateString } from "./OfflineStorage";
import type { RecapInput } from "./MonthlyRecapService";

// ──────────────────────────────────────────────
// EMOJI (contained to the story surface — mirrors MonthlyRecapService)
// ──────────────────────────────────────────────

export const STORY_EMOJI_ENABLED = true;
const STORY_EMOJI = {
  year: "📅",
  anniversary: "🎉",
  five_year: "🏔️",
  documentary: "🎬",
  training: "💪",
  body: "📈",
  consistency: "⭐",
  trophy: "🏆",
} as const;
type StoryEmojiKey = keyof typeof STORY_EMOJI;
function withEmoji(text: string, key: StoryEmojiKey): string {
  return STORY_EMOJI_ENABLED ? `${text} ${STORY_EMOJI[key]}` : text;
}

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type StoryHorizon = "year" | "anniversary" | "five_year" | "documentary";

export interface StorySection {
  icon: string;
  title: string;
  body: string;
  stat?: { value: string; label: string };
}

export interface StoryArtifact {
  /** Stable id: "year:2026" | "anniversary:1" | "five_year:2026" | "documentary:journey". */
  id: string;
  horizon: StoryHorizon;
  title: string;
  subtitle: string;
  headline: string;
  hero: { value: string; label: string };
  sections: StorySection[];
  signoff: string;
  /** Inclusive local date range covered, for provenance. */
  range: { start: string; end: string };
  createdAt: string;
}

// ──────────────────────────────────────────────
// DATE HELPERS
// ──────────────────────────────────────────────

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${`${m}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`;
}

/** Lexical range test for YYYY-MM-DD strings (start/end inclusive). */
function inRange(date: string, start: string, end: string): boolean {
  return !!date && date >= start && date <= end;
}

/** Local YYYY-MM-DD of an ISO timestamp (null when unparseable). */
function isoDate(iso: string): string | null {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : toLocalDateString(t);
}

function wholeYearsBetween(start: string, today: string): number {
  const [sy, sm, sd] = start.split("-").map((n) => parseInt(n, 10));
  const [ty, tm, td] = today.split("-").map((n) => parseInt(n, 10));
  let years = ty - sy;
  if (tm < sm || (tm === sm && td < sd)) years -= 1;
  return years;
}

/** Add whole years to a YYYY-MM-DD (clamped to valid days for Feb 29 → Feb 28). */
function addYears(date: string, n: number): string {
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const lastDay = new Date(y + n, m, 0).getDate();
  return ymd(y + n, m, Math.min(d, lastDay));
}

/** Day before a YYYY-MM-DD. */
function dayBefore(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return toLocalDateString(dt);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ──────────────────────────────────────────────
// AGGREGATION (pure, over an inclusive date range)
// ──────────────────────────────────────────────

export interface StoryStats {
  hasActivity: boolean;
  workouts: number;
  totalReps: number;
  minutes: number;
  perfectWorkouts: number;
  activeDays: number;
  bestStreak: number;
  monthsActive: number;
  perfectNutritionDays: number;
  weighIns: number;
  bodyDeltaKg: number | null;
  bodyDirection: "down" | "up" | "flat" | null;
  milestones: number;
  topAchievement: { name: string; tier: AchievementTier; tierLabel: string; color: string } | null;
}

/** Longest run of consecutive calendar days in a set, by real date arithmetic. */
function longestStreak(dates: Set<string>): number {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prevMs = -Infinity;
  for (const d of sorted) {
    const [y, m, day] = d.split("-").map((n) => parseInt(n, 10));
    const ms = new Date(y, m - 1, day).getTime();
    run = ms - prevMs === 86_400_000 ? run + 1 : 1;
    if (run > best) best = run;
    prevMs = ms;
  }
  return best;
}

export function aggregate(input: RecapInput, start: string, end: string): StoryStats {
  const workouts = input.workoutLog.filter((w) => inRange(w.date, start, end));
  const sessions = input.sessionHistory.filter((s) => inRange(s.date, start, end));
  const diet = input.dietHistory.filter((d) => inRange(d.date, start, end));
  const body = input.bodyLogs
    .filter((b) => inRange(b.date, start, end))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalReps = sessions.reduce((s, x) => s + (x.totalReps || 0), 0);
  const minutes = workouts.reduce((s, w) => s + (w.durationMinutes || 0), 0);
  const perfectWorkouts = workouts.filter((w) => w.completionPercent >= 100).length;
  const perfectNutritionDays = diet.filter((d) => d.status === "completed").length;

  const active = new Set<string>();
  for (const w of workouts) active.add(w.date);
  for (const d of diet) if ((d.mealsConsumed || 0) > 0) active.add(d.date);
  for (const b of body) active.add(b.date);

  const months = new Set<string>();
  for (const d of active) months.add(d.slice(0, 7));

  let bodyDeltaKg: number | null = null;
  let bodyDirection: StoryStats["bodyDirection"] = null;
  if (body.length >= 2) {
    bodyDeltaKg = round1(body[body.length - 1].weightKg - body[0].weightKg);
    bodyDirection = bodyDeltaKg < -0.1 ? "down" : bodyDeltaKg > 0.1 ? "up" : "flat";
  }

  // Milestones (achievements + challenges + trophies) whose timestamp lands in range.
  const tierRank: Record<AchievementTier, number> = {
    mythic: 5, platinum: 4, gold: 3, silver: 2, bronze: 1,
  };
  let topAchievement: StoryStats["topAchievement"] = null;
  let achievements = 0;
  for (const [id, iso] of Object.entries(input.earnedAchievements)) {
    const d = isoDate(iso);
    if (!d || !inRange(d, start, end)) continue;
    achievements++;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    if (!topAchievement || tierRank[def.tier] > tierRank[topAchievement.tier]) {
      const meta = TIER_META[def.tier];
      topAchievement = { name: def.name, tier: def.tier, tierLabel: meta.label, color: meta.color };
    }
  }
  let challenges = 0;
  for (const iso of Object.values(input.completedChallenges)) {
    const d = isoDate(iso);
    if (d && inRange(d, start, end)) challenges++;
  }
  const trophies = (input.trophies ?? []).filter((t) => {
    const pk = t.periodKey; // YYYY-MM — count if the month falls in range
    return pk && pk >= start.slice(0, 7) && pk <= end.slice(0, 7);
  }).length;

  return {
    hasActivity: active.size > 0 || achievements > 0 || challenges > 0 || body.length > 0,
    workouts: workouts.length,
    totalReps,
    minutes,
    perfectWorkouts,
    activeDays: active.size,
    bestStreak: longestStreak(active),
    monthsActive: months.size,
    perfectNutritionDays,
    weighIns: body.length,
    bodyDeltaKg,
    bodyDirection,
    milestones: achievements + challenges + trophies,
    topAchievement,
  };
}

// ──────────────────────────────────────────────
// SECTION BUILDERS (shared across horizons)
// ──────────────────────────────────────────────

function num(n: number): string {
  return n.toLocaleString();
}

function commonSections(stats: StoryStats): StorySection[] {
  const out: StorySection[] = [];

  if (stats.workouts > 0) {
    out.push({
      icon: "barbell",
      title: withEmoji("Training", "training"),
      body:
        `${num(stats.workouts)} workouts, ${num(stats.totalReps)} reps, ${num(stats.minutes)} minutes of effort` +
        (stats.perfectWorkouts > 0 ? ` — ${stats.perfectWorkouts} of them flawless.` : "."),
      stat: { value: num(stats.workouts), label: "workouts" },
    });
  }

  out.push({
    icon: "flame",
    title: withEmoji("Consistency", "consistency"),
    body:
      `${num(stats.activeDays)} days you showed up` +
      (stats.bestStreak >= 3 ? `, with a best run of ${stats.bestStreak} in a row.` : ".") +
      (stats.monthsActive > 1 ? ` Active across ${stats.monthsActive} months.` : ""),
    stat: { value: num(stats.activeDays), label: "active days" },
  });

  if (stats.bodyDeltaKg != null && stats.bodyDirection && stats.bodyDirection !== "flat") {
    const dir = stats.bodyDirection === "down" ? "Down" : "Up";
    out.push({
      icon: "trending-up",
      title: withEmoji("Your body", "body"),
      body: `${dir} ${Math.abs(stats.bodyDeltaKg)} kg across ${stats.weighIns} check-ins — real, measured change.`,
      stat: { value: `${stats.bodyDirection === "down" ? "−" : "+"}${Math.abs(stats.bodyDeltaKg)}`, label: "kg" },
    });
  }

  if (stats.milestones > 0) {
    out.push({
      icon: "trophy",
      title: withEmoji("Milestones", "trophy"),
      body:
        `${stats.milestones} milestone${stats.milestones === 1 ? "" : "s"} earned` +
        (stats.topAchievement ? `, topped by ${stats.topAchievement.name} (${stats.topAchievement.tierLabel}).` : "."),
      stat: { value: num(stats.milestones), label: "earned" },
    });
  }

  return out;
}

function emptyArtifact(
  id: string,
  horizon: StoryHorizon,
  title: string,
  subtitle: string,
  range: { start: string; end: string },
  now: Date,
): StoryArtifact {
  return {
    id,
    horizon,
    title,
    subtitle,
    headline: "Quiet, but the page is yours",
    hero: { value: "0", label: "logged days" },
    sections: [
      {
        icon: "leaf",
        title: "A fresh page",
        body: "Not much logged in this window yet — every entry from here writes the story.",
      },
    ],
    signoff: closer(id),
    range,
    createdAt: now.toISOString(),
  };
}

// ──────────────────────────────────────────────
// HORIZON BUILDERS
// ──────────────────────────────────────────────

/** The calendar year `year` (Jan 1 – Dec 31), wrapped. */
export function buildYearStory(input: RecapInput, year: number, now: Date = new Date()): StoryArtifact {
  const start = ymd(year, 1, 1);
  const end = ymd(year, 12, 31);
  const stats = aggregate(input, start, end);
  const range = { start, end };
  if (!stats.hasActivity) {
    return emptyArtifact(`year:${year}`, "year", `${year}, wrapped`, "Your year on Welliva", range, now);
  }
  return {
    id: `year:${year}`,
    horizon: "year",
    title: withEmoji(`${year}, wrapped`, "year"),
    subtitle: "Your year on Welliva",
    headline: yearHeadline(stats, year),
    hero: { value: num(stats.activeDays), label: "active days this year" },
    sections: commonSections(stats),
    signoff: `${celebrate(`year:${year}`)} Here's to the next one.`,
    range,
    createdAt: now.toISOString(),
  };
}

function yearHeadline(stats: StoryStats, year: number): string {
  if (stats.bestStreak >= 30) return `${year} was relentless`;
  if (stats.workouts >= 100) return `${year} was all in`;
  if (stats.activeDays >= 150) return `${year}: you kept showing up`;
  return `${year}, the year you started`;
}

/** The most recently completed journey anniversary year, or null if under a year in. */
export function buildAnniversaryStory(
  input: RecapInput,
  journeyStartedAt: string,
  now: Date = new Date(),
): StoryArtifact | null {
  const today = toLocalDateString(now);
  const years = wholeYearsBetween(journeyStartedAt, today);
  if (years < 1) return null;
  const start = addYears(journeyStartedAt, years - 1);
  const end = dayBefore(addYears(journeyStartedAt, years));
  const stats = aggregate(input, start, end);
  const ordinal = years === 1 ? "One year" : `${years} years`;
  const range = { start, end };
  if (!stats.hasActivity) {
    return emptyArtifact(
      `anniversary:${years}`,
      "anniversary",
      withEmoji(`${ordinal} with Welliva`, "anniversary"),
      "Happy anniversary",
      range,
      now,
    );
  }
  return {
    id: `anniversary:${years}`,
    horizon: "anniversary",
    title: withEmoji(`${ordinal} with Welliva`, "anniversary"),
    subtitle: "Look how far you've come",
    headline:
      years === 1 ? "One year in — and it shows" : `${years} years of showing up for yourself`,
    hero: { value: num(stats.activeDays), label: "active days this year" },
    sections: commonSections(stats),
    signoff: `${celebrate(`anniversary:${years}`)} Onto year ${years + 1}.`,
    range,
    createdAt: now.toISOString(),
  };
}

/** The last five calendar years (or the whole journey if shorter). */
export function buildFiveYearStory(
  input: RecapInput,
  journeyStartedAt: string | undefined,
  now: Date = new Date(),
): StoryArtifact {
  const endYear = now.getFullYear();
  const startYear = Math.max(
    endYear - 4,
    journeyStartedAt ? parseInt(journeyStartedAt.slice(0, 4), 10) : endYear - 4,
  );
  const start = ymd(startYear, 1, 1);
  const end = ymd(endYear, 12, 31);
  const stats = aggregate(input, start, end);
  const span = endYear - startYear + 1;
  const range = { start, end };
  if (!stats.hasActivity) {
    return emptyArtifact(`five_year:${endYear}`, "five_year", "The long view", "Your multi-year arc", range, now);
  }
  return {
    id: `five_year:${endYear}`,
    horizon: "five_year",
    title: withEmoji("The long view", "five_year"),
    subtitle: `${span} year${span === 1 ? "" : "s"}, one throughline`,
    headline: "The compounding is the point",
    hero: { value: num(stats.activeDays), label: "active days, all-time window" },
    sections: commonSections(stats),
    signoff: `${celebrate(`five_year:${endYear}`)} Still building.`,
    range,
    createdAt: now.toISOString(),
  };
}

/** A documentary of the whole journey so far (journeyStartedAt → today). */
export function buildJourneyDocumentary(
  input: RecapInput,
  journeyStartedAt: string,
  now: Date = new Date(),
): StoryArtifact {
  const start = journeyStartedAt;
  const end = toLocalDateString(now);
  const stats = aggregate(input, start, end);
  const range = { start, end };
  if (!stats.hasActivity) {
    return emptyArtifact("documentary:journey", "documentary", withEmoji("Your story so far", "documentary"), "The whole journey", range, now);
  }
  return {
    id: "documentary:journey",
    horizon: "documentary",
    title: withEmoji("Your story so far", "documentary"),
    subtitle: "The whole journey, in one fold",
    headline: stats.topAchievement
      ? `From day one to ${stats.topAchievement.name}`
      : "Every entry, one story",
    hero: { value: num(stats.activeDays), label: "days you showed up" },
    sections: commonSections(stats),
    signoff: `${celebrate("documentary:journey")} And you're still writing it.`,
    range,
    createdAt: now.toISOString(),
  };
}

// ──────────────────────────────────────────────
// "WHAT'S READY" + ARCHIVE
// ──────────────────────────────────────────────

/** Days after the anniversary date we still consider an anniversary story "fresh". */
const ANNIVERSARY_WINDOW_DAYS = 14;

/**
 * The long-horizon stories that are READY to surface today. Deterministic:
 *  - a year story in early January (for the year that just ended);
 *  - an anniversary story within two weeks of a journey anniversary;
 *  - the journey documentary once there's a meaningful history (≥ 90 days).
 * Highest-signal first.
 */
export function buildDueStories(
  input: RecapInput,
  journeyStartedAt: string | undefined,
  now: Date = new Date(),
): StoryArtifact[] {
  const out: StoryArtifact[] = [];
  const today = toLocalDateString(now);

  // Anniversary — within the post-anniversary window.
  if (journeyStartedAt) {
    const years = wholeYearsBetween(journeyStartedAt, today);
    if (years >= 1) {
      const anniv = addYears(journeyStartedAt, years);
      const since =
        (new Date(today).getTime() - new Date(anniv).getTime()) / 86_400_000;
      if (since >= 0 && since <= ANNIVERSARY_WINDOW_DAYS) {
        const s = buildAnniversaryStory(input, journeyStartedAt, now);
        if (s) out.push(s);
      }
    }
  }

  // Year — early January, for the year that just closed.
  if (now.getMonth() === 0 && now.getDate() <= 14) {
    out.push(buildYearStory(input, now.getFullYear() - 1, now));
  }

  // Documentary — once the journey is meaningful.
  if (journeyStartedAt) {
    const days = (new Date(today).getTime() - new Date(journeyStartedAt).getTime()) / 86_400_000;
    if (days >= 90) out.push(buildJourneyDocumentary(input, journeyStartedAt, now));
  }

  return out.filter((s) => s.range.start <= s.range.end);
}

// ── archive (health-os store, partitioned key registry) ──

export async function listArchivedStories(): Promise<StoryArtifact[]> {
  const list = await store.get<StoryArtifact[]>(K.STORY_ARCHIVE, []);
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getStory(id: string): Promise<StoryArtifact | null> {
  const list = await store.get<StoryArtifact[]>(K.STORY_ARCHIVE, []);
  return list.find((s) => s.id === id) ?? null;
}

/** Archive a story (idempotent by id — re-archiving refreshes it in place). */
export async function archiveStory(artifact: StoryArtifact): Promise<void> {
  const list = await store.get<StoryArtifact[]>(K.STORY_ARCHIVE, []);
  const next = list.filter((s) => s.id !== artifact.id);
  next.push(artifact);
  await store.set(K.STORY_ARCHIVE, next);
}

/** Generate + archive every ready story; returns what's now ready (for delivery/UI). */
export async function generateDueStories(
  input: RecapInput,
  journeyStartedAt: string | undefined,
  now: Date = new Date(),
): Promise<StoryArtifact[]> {
  const due = buildDueStories(input, journeyStartedAt, now);
  for (const s of due) await archiveStory(s);
  return due;
}

export async function clearStories(): Promise<void> {
  await store.remove(K.STORY_ARCHIVE);
}

// ──────────────────────────────────────────────
// ANNIVERSARY → LIFE CONTEXT (the forward path)
// ──────────────────────────────────────────────

/**
 * Ensure the NEXT journey anniversary exists as a Life Context entry, so it flows through
 * the anticipation engine ("Something to mark") and the notification orchestrator — the
 * same forward path every other dated event uses. Idempotent: keyed by a deterministic id.
 */
export async function ensureJourneyAnniversary(
  lifeContext: LifeContextRepository,
  journeyStartedAt: string | undefined,
  now: Date = new Date(),
): Promise<void> {
  if (!journeyStartedAt) return;
  const today = toLocalDateString(now);
  const yearsDone = Math.max(0, wholeYearsBetween(journeyStartedAt, today));
  const nextAnniv = addYears(journeyStartedAt, yearsDone + 1);
  const n = yearsDone + 1;
  try {
    await lifeContext.add(
      {
        id: `anniversary:${n}`,
        kind: "anniversary",
        title: n === 1 ? "One year with Welliva" : `${n} years with Welliva`,
        window: { start: nextAnniv },
        source: "inferred",
        confidence: 1,
      },
      now,
    );
  } catch {
    // a malformed/duplicate stamp must never block boot
  }
}

/** A short, calm description of the freshest ready story, for the notification candidate. */
export function storyNotification(artifact: StoryArtifact): {
  id: string;
  title: string;
  body: string;
  route: string;
} {
  return {
    id: artifact.id,
    title: artifact.title,
    body: `${artifact.headline}. ${artifact.hero.value} ${artifact.hero.label}. Tap to look back.`,
    route: `/story/${encodeURIComponent(artifact.id)}`,
  };
}

export const MONTH_NAME = MONTHS_FULL;
