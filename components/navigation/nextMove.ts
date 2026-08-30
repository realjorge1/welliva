/**
 * NEXT MOVE — the app's answer to "what do I do right now", as a pure function.
 *
 * This is the payload of the Action Bar's left half. It is deliberately a pure
 * resolver over a plain snapshot rather than a hook: the bar makes a factual
 * claim on every screen it appears on ("Exercise 3 of 8", "1.2 L to go"), and
 * the standing rule is that anything which says it counts must count exactly
 * that. A ladder living inside a component is a ladder nobody can test.
 *
 * THE LADDER IS THE PRODUCT. First match wins, and the order encodes what a
 * coach standing next to you would actually say:
 *
 *    1. a session you abandoned mid-set beats everything — finish it
 *    2. a person with no plan at all needs a plan, not a nudge
 *    3. inside a real eating window, the meal is the move
 *    4. a day with no meals scheduled can't be logged against — plan it
 *    5. otherwise the day's training is the move
 *    6. a meal whose hour has passed unlogged can still be caught up
 *    7. a conversation with the coach that nobody finished
 *    8. then the module setup that makes tomorrow's recommendation better
 *    9. then the evening self-report, once the evening is a real report
 *   10. then the weekly weigh-in, if a week has gone by
 *   11. then hydration, the only target still open all day
 *   12. and when it's genuinely all done, say so — rest days by name
 *
 * WHAT'S DUE VS WHAT'S MISSED. Rungs 3 and 6 are the same meal at two moments:
 * inside its window it's due, after its window it's a catch-up, and the copy
 * changes to match ("Log lunch" vs "Log lunch · Earlier today"). Nothing is
 * ever phrased as a failure — the bar prompts a RECORD, it doesn't grade a day.
 *
 * WHY THE MEAL WINDOWS ARE NARROW. They're the actual hours people eat, not
 * thirds of a day. Outside them no meal is "due", which is what lets training
 * surface at 4pm and dinner surface at 6pm off the same ladder. Widen these and
 * the bar says "Log dinner" all afternoon and stops reading as though it knows
 * what time it is — which is the entire effect being bought here.
 *
 * SNACKS NEVER DRIVE THE BAR. They have no hour, they're optional by design,
 * and a bar that asks you to log a snack you didn't eat is exactly the cosmetic
 * nudge this file exists to avoid.
 */

import type { Ionicons } from "@expo/vector-icons";
import { CONTINUE_NUDGES } from "@/services/gozlin/conversationTitle";

type IconName = keyof typeof Ionicons.glyphMap;

/** A meal slot the bar is willing to ask about, with its real-world window. */
export interface MealSlot {
  type: "breakfast" | "lunch" | "dinner";
  name: string;
  consumed: boolean;
}

/**
 * Eating windows, in minutes from midnight. Outside every window, no meal is
 * due — see the header note. They never overlap, so at most one can match.
 */
export const MEAL_WINDOWS: Record<MealSlot["type"], readonly [number, number]> = {
  breakfast: [5 * 60, 10 * 60 + 30],
  lunch: [11 * 60 + 30, 15 * 60],
  dinner: [17 * 60 + 30, 21 * 60 + 30],
};

/** One tap of the water control, in millilitres. Matches the quick-add pill. */
export const WATER_TAP_ML = 250;

/**
 * The hour the day's check-in becomes worth asking for. Mood, energy and sleep
 * are a report on a day, so asking at 9am is asking someone to guess.
 */
export const CHECKIN_FROM_MINUTE = 18 * 60;

/** Nothing asks for anything before this — a bar that nags at 4am is a bug. */
export const QUIET_UNTIL_MINUTE = 7 * 60;

/** Days between weigh-ins before the bar offers one. Weekly, not daily. */
export const WEIGH_IN_INTERVAL_DAYS = 7;

export interface NextMoveInput {
  /** Local clock as minutes from midnight. Injected so the ladder is testable. */
  minutesOfDay: number;
  /** A live, resumable session saved mid-flight, if there is one. */
  savedSession: { label: string; index: number; total: number } | null;
  /** Today's meals in slot order. Empty when nothing is scheduled. */
  meals: MealSlot[];
  /** Whether today resolved to a diet at all. */
  hasScheduledDiet: boolean;
  /** Today's planned training session, if the plan has one for this weekday. */
  todaySession: { focus: string; minutes: number } | null;
  /** Whether a workout plan exists at all. */
  hasPlan: boolean;
  /** Any workout logged today. */
  workoutDoneToday: boolean;
  /**
   * Today is a planned recovery day. Only meaningful with a plan: the local
   * generator emits training days ONLY, so "no session today" on a real plan
   * means rest, and the finished-day caption says so instead of implying the
   * day was empty.
   */
  isRestDay: boolean;
  /** The fitness module's own setup questionnaire. */
  setupComplete: boolean;
  /** Today's self-report already exists. */
  checkedInToday: boolean;
  /** Days since the last body log. Null when there has never been one. */
  daysSinceWeighIn: number | null;
  /**
   * A coach conversation nobody closed — see `findOpenThread`, which owns the
   * (deliberately narrow) definition of what counts as unfinished.
   *
   * WHY THE SEED IS PASSED IN RATHER THAN ROLLED HERE. This resolver is pure,
   * and the whole ladder's testability rests on that. The phrasing still has to
   * vary — a bar that says the identical sentence every single time it offers
   * this is a bar that stops being read — so the caller draws the number and
   * this picks the words from it. Random where it belongs, deterministic where
   * it matters.
   */
  openConversation: { topic: string; nudgeSeed: number } | null;
  waterMl: number;
  waterGoalMl: number;
  /** Next training day's focus, for the finished-day preview. Null if none. */
  tomorrowFocus: string | null;
  /**
   * The screen the bar is currently on, as a menu `href`. Rungs that would only
   * navigate here are skipped.
   *
   * WHY THE LADDER CARES ABOUT ROUTING. On the Diet screen the top rung is
   * usually "Log breakfast", whose action is "go to Diet" — a button that does
   * nothing, on the one screen where the user is most likely to press it. The
   * honest fix isn't to disable the tap, it's to say something else: you are
   * already where that move happens, so the bar should offer what THIS screen
   * can't do. Pass null to disable the check.
   */
  currentHref?: string | null;
}

export type NextMoveAction =
  /** Reopen the paused guided session exactly where it stopped. */
  | { kind: "resume" }
  /** Launch today's planned session. */
  | { kind: "startSession" }
  /** Switch to a root screen. */
  | { kind: "route"; href: string }
  /** Push a detail screen (keeps its own back stack). */
  | { kind: "push"; href: string }
  /** Write one glass of water, in place, without leaving the screen. */
  | { kind: "water"; ml: number }
  /** Open the daily self-report sheet. */
  | { kind: "checkin" }
  /** Open the weigh-in sheet. */
  | { kind: "weighin" };

export interface NextMove {
  /**
   * Stable identity for this rung. Drives the label crossfade key and is what
   * the tests assert on — the copy may be retuned, the ladder may not.
   */
  id: string;
  label: string;
  /** Trailing detail. Always a real number or a real name, never a mood. */
  caption?: string;
  icon: IconName;
  action: NextMoveAction;
  /**
   * `calm` drops the gradient fill for a quiet outline: the bar has nothing to
   * ask for. A finished day should look finished, not like an unpressed button.
   */
  tone: "primary" | "calm";
}

/** The meal whose window contains `minutesOfDay`, or null between windows. */
export function mealDueAt(
  minutesOfDay: number,
  meals: MealSlot[],
): MealSlot | null {
  for (const meal of meals) {
    const window = MEAL_WINDOWS[meal.type];
    if (!window) continue;
    if (minutesOfDay >= window[0] && minutesOfDay < window[1]) return meal;
  }
  return null;
}

/**
 * The most recent meal whose window has closed with nothing logged against it.
 *
 * "Missed" here means only that the hour has passed and the row is still empty
 * — it is a prompt to record, never a judgement about eating. The LATEST one
 * wins so the bar asks about lunch rather than still asking about breakfast,
 * and each candidate stops being offered as soon as its successor's window
 * closes, which is what keeps a habitually skipped meal from nagging all day.
 */
export function mealMissedBy(
  minutesOfDay: number,
  meals: MealSlot[],
): MealSlot | null {
  let latest: MealSlot | null = null;
  let latestEnd = -1;
  for (const m of meals) {
    const window = MEAL_WINDOWS[m.type];
    if (!window || m.consumed) continue;
    if (minutesOfDay >= window[1] && window[1] > latestEnd) {
      latest = m;
      latestEnd = window[1];
    }
  }
  return latest;
}

/** Litres to one decimal, for a caption. 800ml → "0.8". */
function litres(ml: number): string {
  return (Math.max(0, ml) / 1000).toFixed(1);
}

/**
 * Resolve the single next move. Total — the final rung is unconditional, so the
 * bar always has something true to say.
 */
export function resolveNextMove(input: NextMoveInput): NextMove {
  const {
    minutesOfDay,
    savedSession,
    meals,
    hasScheduledDiet,
    todaySession,
    hasPlan,
    workoutDoneToday,
    isRestDay,
    setupComplete,
    checkedInToday,
    daysSinceWeighIn,
    openConversation = null,
    waterMl,
    waterGoalMl,
    tomorrowFocus,
    currentHref = null,
  } = input;

  /** True when a rung would only navigate to the screen already on show. */
  const here = (href: string) => currentHref !== null && href === currentHref;

  // 1. An abandoned session. Nothing else matters while a workout is half done —
  //    it's the only state in the app that decays if you walk away from it.
  if (savedSession) {
    return {
      id: "resume",
      label: `Resume ${savedSession.label}`,
      caption: `Exercise ${savedSession.index + 1} of ${savedSession.total}`,
      icon: "play",
      action: { kind: "resume" },
      tone: "primary",
    };
  }

  // 2. Nothing set up at all — the cold-start case this bar was built for. A
  //    person here has no meals to log and no session to start, so every rung
  //    below would be a lie. Send them to the one screen that ends the state.
  if (!hasPlan && !hasScheduledDiet) {
    return {
      id: "build-plan",
      label: "Build your plan",
      caption: "2 min",
      icon: "sparkles",
      action: { kind: "push", href: "/fitness/setup" },
      tone: "primary",
    };
  }

  // 3. Inside a real eating window, with that meal still unlogged. Skipped on
  //    Diet itself, where the meal list is already the thing on screen.
  const due = mealDueAt(minutesOfDay, meals);
  if (due && !due.consumed && !here("/diet")) {
    return {
      id: `log-${due.type}`,
      label: `Log ${due.type}`,
      caption: due.name,
      icon: "restaurant",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
    };
  }

  // 4. A day with no meals on it. The Home plan tile calls this "Add today's
  //    meals"; the bar uses the same words so the two can never disagree.
  if (!hasScheduledDiet && !here("/diet")) {
    return {
      id: "plan-meals",
      label: "Add today's meals",
      caption: "No diet scheduled",
      icon: "add-circle",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
    };
  }

  // 5. Today's training, if the plan asked for it and it hasn't happened.
  if (todaySession && !workoutDoneToday) {
    return {
      id: "start-session",
      label: `Start ${todaySession.focus}`,
      caption: `~${todaySession.minutes} min`,
      icon: "barbell",
      action: { kind: "startSession" },
      tone: "primary",
    };
  }

  // 6. A meal whose hour has been and gone with nothing logged. Below training
  //    on purpose: the session is time-sensitive, the record can be caught up.
  const missed = mealMissedBy(minutesOfDay, meals);
  if (missed && !here("/diet")) {
    return {
      id: `catchup-${missed.type}`,
      label: `Log ${missed.type}`,
      caption: "Earlier today",
      icon: "restaurant-outline",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
    };
  }

  // 7. A conversation with the coach that nobody finished — you asked and no
  //    answer landed, or Gozlin asked you something back and you never said.
  //
  //    WHY IT SITS HERE AND NOT AT THE TOP. It is the only rung that is about
  //    something you were doing rather than something the day needs, so it must
  //    never displace a meal in its window or the session that's due — those
  //    have hours attached and this does not. But it belongs above the setup
  //    and self-report rungs, because those are preparation and admin and this
  //    is a live thread with a question sitting in it. In practice that puts it
  //    exactly where it should be: in the gaps of a day that is otherwise on
  //    top of itself.
  //
  //    The label rotates (see NextMoveInput.openConversation) and the caption is
  //    the thread's own topic, so the bar names the thing you'd be going back to
  //    rather than offering a generic trip to the chat screen.
  if (openConversation && !here("/gozlin")) {
    const nudge =
      CONTINUE_NUDGES[
        Math.abs(Math.trunc(openConversation.nudgeSeed)) % CONTINUE_NUDGES.length
      ];
    return {
      id: "continue-chat",
      label: nudge,
      caption: openConversation.topic,
      icon: "chatbubble-ellipses",
      action: { kind: "route", href: "/gozlin" },
      tone: "primary",
    };
  }

  // 8. The questionnaire that makes tomorrow's recommendation better. It sits
  //    below the day's actual work because it is preparation, not the thing.
  if (!setupComplete) {
    return {
      id: "personalize",
      label: "Personalize training",
      caption: "2 min",
      icon: "options",
      action: { kind: "push", href: "/fitness/setup" },
      tone: "primary",
    };
  }

  // 9. The evening self-report. Gated to the evening because mood, energy and
  //    sleep are a report ON a day — asked at nine in the morning it's a guess.
  if (!checkedInToday && minutesOfDay >= CHECKIN_FROM_MINUTE) {
    return {
      id: "checkin",
      label: "Check in",
      caption: "Mood, energy & sleep",
      icon: "sunny-outline",
      action: { kind: "checkin" },
      tone: "primary",
    };
  }

  // 10. A weekly weigh-in. Interval-gated rather than daily: asking every
  //    morning trains people to ignore it, and daily noise is not a trend.
  const weighInDue =
    minutesOfDay >= QUIET_UNTIL_MINUTE &&
    (daysSinceWeighIn === null || daysSinceWeighIn >= WEIGH_IN_INTERVAL_DAYS);
  if (weighInDue) {
    return {
      id: "weighin",
      label: "Log your weight",
      caption:
        daysSinceWeighIn === null
          ? "Your first one"
          : `${daysSinceWeighIn} days since the last`,
      icon: "scale-outline",
      action: { kind: "weighin" },
      tone: "primary",
    };
  }

  // 11. Hydration — the one target with no hour attached, so it fills the gaps.
  //     It acts IN PLACE: tapping writes a glass and the bar re-derives beneath
  //     the finger, which is the whole reason it isn't a link to somewhere.
  if (waterGoalMl > 0 && waterMl < waterGoalMl) {
    return {
      id: "water",
      label: "Log water",
      caption: `${litres(waterGoalMl - waterMl)} L to go`,
      icon: "water",
      action: { kind: "water", ml: WATER_TAP_ML },
      tone: "primary",
    };
  }

  // 12. Done. It says so, and it points at tomorrow rather than at nothing — a
  //     dead-end control on a finished day teaches people to stop looking at it.
  //     On Logs itself the record is already open, so it points home instead.
  //
  //     A rest day gets its own words: "Day complete" on a day the plan asked
  //     for nothing reads as though the app didn't notice, and recovery being
  //     part of the plan is the single thing people most need telling.
  const recordHref = here("/logs") ? "/" : "/logs";
  const caption = isRestDay
    ? "Rest day — recovery counts"
    : tomorrowFocus
      ? `Tomorrow: ${tomorrowFocus}`
      : here("/logs")
        ? "Back to today"
        : "See your record";
  return {
    id: isRestDay ? "rest" : "complete",
    label: isRestDay ? "All done for today" : "Day complete",
    caption,
    icon: isRestDay ? "moon" : "checkmark-circle",
    action: { kind: "route", href: recordHref },
    tone: "calm",
  };
}
