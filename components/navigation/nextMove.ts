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
  /**
   * The screen this move would ONLY navigate to. The cue skips a move whose
   * `suppressOn` is the screen you are standing on; the agenda never does — see
   * `resolveAgenda`. Absent on every move that writes rather than travels,
   * which is why water stands on Diet and a meal row does not.
   */
  suppressOn?: string;
  /**
   * Already in flight rather than something the day is asking for. The dock
   * gives these its top slot, draws them as a controller rather than a prompt,
   * and refuses to dismiss them.
   */
  live?: boolean;
  /**
   * Whether "not now" is a thing a person may say to this. False for the two
   * moves that ARE the app working at all (a half-finished session, an account
   * with nothing set up): dismissing those would leave a screen with no way
   * forward and call it restraint.
   */
  dismissible: boolean;
  /**
   * Minute-of-day after which this move is stale, so a dismissal of it can
   * expire on its own. Only the meal rungs set it — their windows are already
   * narrow, which is what lets "not now" mean exactly "not in this window"
   * instead of needing a seen-it flag that outlives the day.
   */
  staleAfterMinute?: number;
  /**
   * Whose voice this is. `gozlin` wears the coach's mark instead of an Ionicon,
   * the same rule the menu row follows: the coach has an identity and a generic
   * glyph throws it away.
   */
  voice?: "gozlin";
  /**
   * Progress through a live thing, for the controller's segment bar. Set only
   * on `live` moves, where the numbers are a real position in a real session.
   */
  segments?: { at: number; of: number };
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

/* ───────────────────────────── the agenda ─────────────────────────────── */

/**
 * Today's scheduled commitments, done against total.
 *
 * THIS IS THE NUMBER THE HOME TAB'S RING DRAWS, so it has to survive the
 * standing rule that anything claiming to count must count exactly that. Its
 * scope is stated in one place and read in two: the ring and the agenda's own
 * header ("3 of 6 done today") come from this function, so they cannot drift.
 *
 * WHAT COUNTS. Only commitments the day actually made:
 *   · each meal the day's schedule holds — not "three meals", the ones planned
 *   · today's training session, and only when the plan asked for one
 *   · the evening check-in, and only once the evening can be reported on
 *
 * WHAT DOESN'T. Water (a target, not a commitment, and continuous), the
 * weigh-in (weekly, so it would make most days open at 5 of 6 for no reason)
 * and anything the coach suggests. A ring that fills from things nobody
 * scheduled is a progress bar for being alive.
 */
export interface DayProgress {
  done: number;
  total: number;
}

export function resolveDayProgress(input: NextMoveInput): DayProgress {
  const {
    meals,
    todaySession,
    hasPlan,
    isRestDay,
    workoutDoneToday,
    minutesOfDay,
    checkedInToday,
  } = input;

  let done = 0;
  let total = 0;

  for (const m of meals) {
    total += 1;
    if (m.consumed) done += 1;
  }

  if (hasPlan && todaySession && !isRestDay) {
    total += 1;
    if (workoutDoneToday) done += 1;
  }

  if (minutesOfDay >= CHECKIN_FROM_MINUTE) {
    total += 1;
    if (checkedInToday) done += 1;
  }

  return { done, total };
}

/**
 * EVERY open move, in ladder order, with nothing suppressed.
 *
 * WHY THIS EXISTS SEPARATELY FROM `resolveNextMove`. The ladder always knew
 * there were four things open and only ever said one of them, which is what
 * made a perfectly correct suggestion read as bossy: there was no way to see
 * that it had reasons, and no way to pick the other thing. The dock's agenda
 * shows this list; the cue shows `resolveNextMove`, which is this list filtered
 * and topped. One computation, two altitudes — they cannot disagree.
 *
 * IT DOES NOT SUPPRESS BY ROUTE. `suppressOn` travels ON each move and is
 * applied by the cue, not here: an agenda that hid lunch because you happen to
 * be standing on Diet would report "2 open" while three things were open, and
 * the count is the whole reason anyone would trust the list.
 *
 * THERE IS NO TERMINAL RUNG HERE. An empty list means the day is genuinely
 * clear, and the dock answers that with nothing at all rather than with a card
 * saying so — see `finishedDayMove` for the sentence a finished day still owes
 * the one surface that must never be empty.
 */
export function resolveAgenda(input: NextMoveInput): NextMove[] {
  const {
    minutesOfDay,
    savedSession,
    meals,
    hasScheduledDiet,
    todaySession,
    hasPlan,
    workoutDoneToday,
    setupComplete,
    checkedInToday,
    daysSinceWeighIn,
    openConversation = null,
    waterMl,
    waterGoalMl,
  } = input;

  const moves: NextMove[] = [];

  // 1. An abandoned session. Nothing else matters while a workout is half done
  //    — it is the only state in the app that decays if you walk away from it,
  //    and the only one the dock treats as LIVE: it is already happening, so it
  //    gets the controller card and can never be dismissed.
  if (savedSession) {
    moves.push({
      id: "resume",
      label: `Resume ${savedSession.label}`,
      caption: `Exercise ${savedSession.index + 1} of ${savedSession.total}`,
      icon: "play",
      action: { kind: "resume" },
      tone: "primary",
      live: true,
      dismissible: false,
      segments: { at: savedSession.index, of: savedSession.total },
    });
  }

  // 2. Nothing set up at all — the cold-start case. A person here has no meals
  //    to log and no session to start, so every rung below would be a lie. This
  //    is the one place the list stops early rather than ranking.
  if (!hasPlan && !hasScheduledDiet) {
    moves.push({
      id: "build-plan",
      label: "Build your plan",
      caption: "2 min",
      icon: "sparkles",
      action: { kind: "push", href: "/fitness/setup" },
      tone: "primary",
      dismissible: false,
    });
    return moves;
  }

  // 3. Inside a real eating window, with that meal still unlogged. A dismissal
  //    of this one expires when the window does — the narrowest suppression in
  //    the app, and the reason "not now" never needs a memory that outlives it.
  const due = mealDueAt(minutesOfDay, meals);
  if (due && !due.consumed) {
    moves.push({
      id: `log-${due.type}`,
      label: `Log ${due.type}`,
      caption: due.name,
      icon: "restaurant",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
      suppressOn: "/diet",
      dismissible: true,
      staleAfterMinute: MEAL_WINDOWS[due.type][1],
    });
  }

  // 4. A day with no meals on it. The Home plan tile calls this "Add today's
  //    meals"; the ladder uses the same words so the two can never disagree.
  if (!hasScheduledDiet) {
    moves.push({
      id: "plan-meals",
      label: "Add today's meals",
      caption: "No diet scheduled",
      icon: "add-circle",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
      suppressOn: "/diet",
      dismissible: true,
    });
  }

  // 5. Today's training, if the plan asked for it and it has not happened.
  if (todaySession && !workoutDoneToday) {
    moves.push({
      id: "start-session",
      label: `Start ${todaySession.focus}`,
      caption: `~${todaySession.minutes} min`,
      icon: "barbell",
      action: { kind: "startSession" },
      tone: "primary",
      dismissible: true,
    });
  }

  // 6. A meal whose hour has been and gone with nothing logged. Below training
  //    on purpose: the session is time-sensitive, the record can be caught up.
  const missed = mealMissedBy(minutesOfDay, meals);
  if (missed) {
    moves.push({
      id: `catchup-${missed.type}`,
      label: `Log ${missed.type}`,
      caption: "Earlier today",
      icon: "restaurant-outline",
      action: { kind: "route", href: "/diet" },
      tone: "primary",
      suppressOn: "/diet",
      dismissible: true,
    });
  }

  // 7. A conversation with the coach that nobody finished — you asked and no
  //    answer landed, or Gozlin asked you something back and you never said.
  //
  //    WHY IT SITS HERE AND NOT AT THE TOP. It is the only rung that is about
  //    something you were doing rather than something the day needs, so it must
  //    never displace a meal in its window or the session that is due — those
  //    have hours attached and this does not. But it belongs above the setup
  //    and self-report rungs, because those are preparation and admin and this
  //    is a live thread with a question sitting in it.
  //
  //    It is the one move that carries Gozlin's own voice into the dock, so the
  //    card wears the coach's mark rather than a generic glyph.
  if (openConversation) {
    const nudge =
      CONTINUE_NUDGES[
        Math.abs(Math.trunc(openConversation.nudgeSeed)) % CONTINUE_NUDGES.length
      ];
    moves.push({
      id: "continue-chat",
      label: nudge,
      caption: openConversation.topic,
      icon: "chatbubble-ellipses",
      action: { kind: "route", href: "/gozlin" },
      tone: "primary",
      suppressOn: "/gozlin",
      dismissible: true,
      voice: "gozlin",
    });
  }

  // 8. The questionnaire that makes tomorrow's recommendation better. It sits
  //    below the day's actual work because it is preparation, not the thing.
  if (!setupComplete) {
    moves.push({
      id: "personalize",
      label: "Personalize training",
      caption: "2 min",
      icon: "options",
      action: { kind: "push", href: "/fitness/setup" },
      tone: "primary",
      dismissible: false,
    });
  }

  // 9. The evening self-report. Gated to the evening because mood, energy and
  //    sleep are a report ON a day — asked at nine in the morning it is a guess.
  if (!checkedInToday && minutesOfDay >= CHECKIN_FROM_MINUTE) {
    moves.push({
      id: "checkin",
      label: "Check in",
      caption: "Mood, energy & sleep",
      icon: "sunny-outline",
      action: { kind: "checkin" },
      tone: "primary",
      dismissible: true,
    });
  }

  // 10. A weekly weigh-in. Interval-gated rather than daily: asking every
  //     morning trains people to ignore it, and daily noise is not a trend.
  const weighInDue =
    minutesOfDay >= QUIET_UNTIL_MINUTE &&
    (daysSinceWeighIn === null || daysSinceWeighIn >= WEIGH_IN_INTERVAL_DAYS);
  if (weighInDue) {
    moves.push({
      id: "weighin",
      label: "Log your weight",
      caption:
        daysSinceWeighIn === null
          ? "Your first one"
          : `${daysSinceWeighIn} days since the last`,
      icon: "scale-outline",
      action: { kind: "weighin" },
      tone: "primary",
      dismissible: true,
    });
  }

  // 11. Hydration — the one target with no hour attached, so it fills the gaps.
  //     It acts IN PLACE: tapping writes a glass and the cue re-derives beneath
  //     the finger, which is the whole reason it is not a link to somewhere.
  if (waterGoalMl > 0 && waterMl < waterGoalMl) {
    moves.push({
      id: "water",
      label: "Log water",
      caption: `${litres(waterGoalMl - waterMl)} L to go`,
      icon: "water",
      action: { kind: "water", ml: WATER_TAP_ML },
      tone: "primary",
      dismissible: true,
    });
  }

  return moves;
}

/**
 * The sentence a day with nothing open still owes. Unconditional, so the ladder
 * as a whole stays total.
 *
 * It points at tomorrow rather than at nothing — a dead-end control on a
 * finished day teaches people to stop looking at it. On Logs itself the record
 * is already open, so it points home instead. A rest day gets its own words:
 * "Day complete" on a day the plan asked for nothing reads as though the app
 * did not notice, and recovery being part of the plan is the single thing
 * people most need telling.
 */
export function finishedDayMove(input: NextMoveInput): NextMove {
  const { isRestDay, tomorrowFocus, currentHref = null } = input;
  const onLogs = currentHref === "/logs";
  return {
    id: isRestDay ? "rest" : "complete",
    label: isRestDay ? "All done for today" : "Day complete",
    caption: isRestDay
      ? "Rest day — recovery counts"
      : tomorrowFocus
        ? `Tomorrow: ${tomorrowFocus}`
        : onLogs
          ? "Back to today"
          : "See your record",
    icon: isRestDay ? "moon" : "checkmark-circle",
    action: { kind: "route", href: onLogs ? "/" : "/logs" },
    tone: "calm",
    // Dismissible, unlike the other two undismissible rungs, because this one
    // asks for nothing: it is the app saying the day is done, and a person who
    // has read that once is entitled to have the dock go quiet for the night.
    dismissible: true,
  };
}

/**
 * Resolve the single next move: the first open one this screen can actually act
 * on, or the finished-day sentence. Total — it always has something true to say.
 *
 * WHY THE LADDER CARES ABOUT ROUTING. On the Diet screen the top rung is
 * usually "Log breakfast", whose action is "go to Diet" — a button that does
 * nothing, on the one screen where the user is most likely to press it. The
 * honest fix is not to disable the tap, it is to say something else: you are
 * already where that move happens, so it should offer what THIS screen cannot
 * do. Pass no `currentHref` to disable the check.
 */
export function resolveNextMove(input: NextMoveInput): NextMove {
  const here = input.currentHref ?? null;
  const actionable = resolveAgenda(input).find(
    (m) => m.suppressOn === undefined || here === null || m.suppressOn !== here,
  );
  return actionable ?? finishedDayMove(input);
}
