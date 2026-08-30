/**
 * GOZLIN — Moment Engine (Phase 9 / CXO: "Gozlin everywhere").
 *
 * Turns ONE Twin snapshot into ranked, surface-scoped coach beats — the small
 * presence cards that let Gozlin show up on Home, Workout, Diet, Progress,
 * Habits and Goals instead of only living inside the chat. Pure & deterministic
 * (no storage, no LLM); it reads the same trusted flags/metrics every other
 * Gozlin feature does, so the voice stays consistent across the app.
 *
 * Design: build one flat pool of candidate moments from the Twin, tag each with
 * the surfaces it belongs on and a leverage priority, then let each surface pick
 * its single highest-priority beat. A warm steady fallback per surface means a
 * screen is NEVER without Gozlin — the experience always feels alive.
 *
 * See docs/gozlin/01-personality-bible.md for the voice these lines speak in.
 */

import type {
  GozlinMoment,
  GozlinMomentKind,
  GozlinSurface,
  GozlinTone,
  GozlinTwin,
} from "./gozlin.types";

export interface MomentInput {
  twin: GozlinTwin;
  surface: GozlinSurface;
  /** Injectable for tests/determinism; defaults to now. */
  now?: Date;
}

/** Internal candidate — a moment plus the surfaces it's allowed to appear on. */
interface Candidate extends Omit<GozlinMoment, "id"> {
  id: string;
  surfaces: GozlinSurface[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build every coach beat the current Twin warrants, unranked. */
function candidates(twin: GozlinTwin): Candidate[] {
  const out: Candidate[] = [];
  const f = new Set(twin.flags);
  const { today, momentum, recovery, body } = twin;
  const lateInDay = today.dayProgress >= 0.6;

  const add = (
    id: string,
    kind: GozlinMomentKind,
    surfaces: GozlinSurface[],
    icon: string,
    title: string,
    message: string,
    tone: GozlinTone,
    priority: number,
    prompt: string,
    cta?: string,
    route?: string,
  ) => out.push({ id, kind, surfaces, icon, title, message, tone, priority, prompt, cta, route });

  // ── Risk alerts / interventions (highest leverage) ──
  if (f.has("SETBACK")) {
    add(
      "setback",
      "intervention",
      ["home", "progress", "habits", "goals"],
      "hand-left",
      "Let's reset together",
      "A rough patch doesn't erase the work. One small win today and we're moving again.",
      "gentle",
      92,
      "Help me figure out why I fell off, and how to restart.",
      "Let's talk it through",
    );
  }

  if (recovery.level === "red") {
    add(
      "recovery_red",
      "risk",
      ["workout", "home"],
      "heart-dislike",
      "Your body's asking for rest",
      `Recovery is reading ${recovery.score}/100. Pushing hard today likely costs you more than it builds.`,
      "honest",
      88,
      "Should I train hard today or take it easy to recover?",
      "Ask Gozlin",
    );
  }

  if (f.has("OVER_CALORIES")) {
    add(
      "over_cal",
      "risk",
      ["diet", "home"],
      "trending-up",
      "We're over for today",
      `You're at ${Math.round(today.calories.pct * 100)}% of your calorie target. Let's land the evening light.`,
      "honest",
      82,
      "I'm over on calories today — how should I handle the rest of the day?",
    );
  }

  if (f.has("STREAK_BROKEN")) {
    add(
      "streak_broken",
      "intervention",
      ["home", "progress", "habits"],
      "refresh",
      "Streaks restart, not end",
      "You've done this before — the comeback is just the next check-in. Want to start a new one today?",
      "gentle",
      78,
      "Why did I lose my streak, and what's the easiest way back?",
      "Show me the way back",
    );
  }

  if (f.has("NO_PLAN")) {
    add(
      "no_plan",
      "coach",
      ["diet", "home"],
      "restaurant-outline",
      "No plan set for today",
      "Let's get a day of eating locked in — it's the single thing that moves your goal most.",
      "warm",
      75,
      "What should I eat today? Help me set a plan.",
      "Set today's plan",
      "/diet",
    );
  }

  if (f.has("PROTEIN_LAG")) {
    add(
      "protein_lag",
      "risk",
      ["diet", "home"],
      "barbell-outline",
      "Protein's running behind",
      `You're at ${Math.round(today.protein.pct * 100)}% protein vs ${Math.round(
        today.calories.pct * 100,
      )}% calories. Protein protects your results.`,
      "honest",
      70,
      "How do I catch up on protein for the rest of today?",
    );
  }

  // ── Workout presence ──
  if (f.has("WORKOUT_PENDING")) {
    if (lateInDay) {
      add(
        "workout_pending_late",
        "intervention",
        ["workout", "home"],
        "alarm-outline",
        "Today's session is still open",
        `${today.workout.planned ?? "Your workout"} is waiting. Even a short version keeps the streak alive.`,
        "warm",
        74,
        "Can we still fit today's workout in? Give me a short version.",
        "Start now",
        "/exercise",
      );
    } else {
      add(
        "workout_pending",
        "coach",
        ["workout", "home"],
        "barbell",
        "Today's the day",
        `${today.workout.planned ?? "A session"} is on the board${
          today.workout.minutes ? ` — about ${today.workout.minutes} min` : ""
        }. I'll be with you the whole way.`,
        "steady",
        60,
        "Walk me through today's workout.",
        "See workout",
        "/exercise",
      );
    }
  }

  if (f.has("WORKOUT_DONE")) {
    add(
      "workout_done",
      "celebration",
      ["workout", "home"],
      "trophy",
      "Session done — that's the work",
      "You showed up and finished. This is exactly how the change gets built, one session at a time.",
      "proud",
      66,
      "I finished today's workout — how's my training trending?",
      "See my progress",
      "/fitness/progress",
    );
  }

  if (f.has("REST_DAY")) {
    add(
      "rest_day",
      "coach",
      ["workout"],
      "bed-outline",
      "Recovery is training too",
      "Today's rest is where the adaptation happens. Hydrate, eat your protein, come back strong.",
      "gentle",
      45,
      "How should I make the most of my rest day?",
    );
  }

  // ── Celebrations ──
  if (f.has("STREAK_STRONG")) {
    add(
      "streak_strong",
      "celebration",
      ["home", "progress", "habits"],
      "flame",
      `${momentum.streak}-day streak`,
      "Consistency is your superpower right now. This is how transformations actually happen.",
      "proud",
      64,
      "What habits have you noticed are working for me?",
      "See my habits",
      // The CTA names a screen, so it opens that screen. This card used to send
      // "See my habits" into the chat.
      "/habits",
    );
  }

  if (f.has("PROTEIN_STRONG")) {
    add(
      "protein_strong",
      "celebration",
      ["diet"],
      "checkmark-circle",
      "Protein dialed in",
      "You're hitting protein — the highest-leverage habit for keeping muscle while you change.",
      "proud",
      52,
      "My protein's on point — how's my nutrition trending overall?",
    );
  }

  if (f.has("WATER_DONE")) {
    add(
      "water_done",
      "celebration",
      ["home", "diet"],
      "water",
      "Hydration goal hit",
      "Small habit, big compounding effect on energy and recovery. Nicely done.",
      "proud",
      40,
      "How's my hydration habit looking lately?",
    );
  }

  // ── Momentum insights ──
  if (momentum.trend === "cooling" && momentum.adherence7d < 60 && !f.has("SETBACK")) {
    add(
      "cooling",
      "insight",
      ["progress", "home", "habits"],
      "trending-down-outline",
      "Momentum's cooling a little",
      `Adherence is ${momentum.adherence7d}/100 and easing off. Let's catch it early before it slips.`,
      "honest",
      62,
      "Why is my consistency slipping, and what's the one thing to fix?",
    );
  } else if (momentum.trend === "rising" && momentum.adherence7d >= 60) {
    add(
      "rising",
      "celebration",
      ["progress", "habits"],
      "trending-up",
      "You're trending up",
      `Adherence is climbing (${momentum.adherence7d}/100). Whatever you changed — keep doing it.`,
      "proud",
      48,
      "What's working for me lately that I should keep doing?",
    );
  }

  // ── Forecast / goals ──
  if (body.goalProgress != null) {
    const pct = Math.round(body.goalProgress * 100);
    add(
      "forecast_progress",
      "forecast",
      ["goals", "progress", "home"],
      "flag",
      `${pct}% of the way there`,
      body.measuredRatePerWeek != null
        ? `You're moving ${Math.abs(round1(body.measuredRatePerWeek))} kg/week. Want to see your goal date?`
        : "Log a weigh-in and I'll project your goal date and odds of success.",
      "steady",
      58,
      "What am I on track to achieve, and when?",
      "See forecast",
    );
  } else if (body.goalWeightKg == null) {
    add(
      "set_goal",
      "forecast",
      ["goals", "progress"],
      "flag-outline",
      "Give me a target to aim at",
      "Set a goal weight and I'll forecast your date, your odds, and the one lever that moves them.",
      "warm",
      44,
      "Help me set a goal weight and forecast my results.",
      "Set a goal",
    );
  }

  // ── Hydration / pacing insights ──
  if (f.has("LOW_WATER")) {
    add(
      "low_water",
      "insight",
      ["diet", "home"],
      "water-outline",
      "A little behind on water",
      "An easy win that's sitting right there — a glass now keeps energy and focus up.",
      "curious",
      50,
      "Remind me why hydration matters and help me catch up.",
    );
  }

  if (f.has("BEHIND_CALORIES")) {
    add(
      "behind_cal",
      "insight",
      ["diet", "home"],
      "nutrition-outline",
      "Running low on fuel",
      "You're well under target this late. Under-eating stalls progress as surely as over-eating.",
      "curious",
      46,
      "I'm behind on calories tonight — what should I eat?",
    );
  }

  // ── Steady "on track" beat ──
  if (f.has("ON_TRACK")) {
    add(
      "on_track",
      "coach",
      ["home", "diet"],
      "checkmark-done",
      "Right on pace",
      "Nothing to fix — you're exactly where you should be today. Keep it boring; boring wins.",
      "steady",
      38,
      "What should I focus on today to stay on track?",
    );
  }

  return out;
}

/** A warm, always-available beat so a surface is never without Gozlin. */
const FALLBACK: Record<GozlinSurface, { title: string; message: string; prompt: string; icon: string }> = {
  home: {
    icon: "sparkles",
    title: "I've read your day",
    message: "I'm watching the whole picture with you. Tap me any time you want a read.",
    prompt: "What should I focus on today?",
  },
  workout: {
    icon: "barbell-outline",
    title: "I've got your training",
    message: "Every session you log teaches me how to push you just right.",
    prompt: "How should I train based on how I've been performing?",
  },
  diet: {
    icon: "nutrition-outline",
    title: "I'm on your nutrition",
    message: "Log your meals and I'll keep your protein, calories and energy honest.",
    prompt: "How's my nutrition looking, and what should I tweak?",
  },
  progress: {
    icon: "analytics-outline",
    title: "I'm keeping the long view",
    message: "The scale jumps around — I watch the trend so you don't have to.",
    prompt: "How am I really doing? Give me the honest read.",
  },
  reviews: {
    icon: "calendar-outline",
    title: "Your week, reviewed",
    message: "I'll pull together your wins, watch-outs, and the one focus for next week.",
    prompt: "Give me my weekly review.",
  },
  habits: {
    icon: "repeat-outline",
    title: "I'm learning your rhythms",
    message: "The more you show up, the better I get at seeing who you are behaviorally.",
    prompt: "What habits have you noticed about me?",
  },
  goals: {
    icon: "flag-outline",
    title: "I'm holding your goal in sight",
    message: "Tell me what you're chasing and I'll map the path and your odds.",
    prompt: "What am I on track to achieve?",
  },
};

/**
 * Rank every moment relevant to `surface`, highest leverage first. Always
 * returns at least one (the surface's warm fallback), so Gozlin is omnipresent.
 */
export function buildMoments(input: MomentInput): GozlinMoment[] {
  const { twin, surface } = input;

  // No profile yet → a single gentle onboarding nudge, nothing alarming.
  if (!twin.hasProfile) {
    const fb = FALLBACK[surface];
    return [
      {
        id: "no_profile",
        kind: "coach",
        icon: "sparkles",
        title: "Let's get you set up",
        message: "Finish your profile and I can start coaching you for real.",
        tone: "warm",
        priority: 1,
        prompt: fb.prompt,
      },
    ];
  }

  const pool = candidates(twin)
    .filter((c) => c.surfaces.includes(surface))
    .sort((a, b) => b.priority - a.priority)
    .map(({ surfaces: _surfaces, ...m }) => m);

  if (pool.length > 0) return pool;

  const fb = FALLBACK[surface];
  return [
    {
      id: `fallback_${surface}`,
      kind: "coach",
      icon: fb.icon,
      title: fb.title,
      message: fb.message,
      tone: "warm",
      priority: 5,
      prompt: fb.prompt,
    },
  ];
}

/** Convenience: the single beat a surface should lead with (or null). */
export function topMoment(input: MomentInput): GozlinMoment | null {
  return buildMoments(input)[0] ?? null;
}
