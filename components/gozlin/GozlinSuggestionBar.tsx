/**
 * GozlinSuggestionBar — horizontal smart-prompt chips that lower the effort to
 * engage the coach (Phase 1 §10). Tapping a chip submits its prompt.
 *
 * Chips never compress: each is intrinsically sized and pinned with
 * `flexShrink: 0`, its label kept to a single line, so the row scrolls
 * horizontally instead of squeezing chips into each other.
 *
 * THE BAR MUST HUG ITS CONTENT. React Native's ScrollView carries
 * `flexGrow: 1, flexShrink: 1` in its base style — the HORIZONTAL variant too —
 * so a bare one dropped into a column happily competes with the message list
 * for the leftover vertical space and takes half of it. With
 * `alignItems: "center"` on the content that parked the chips in the middle of
 * an invisible box halfway up the screen. `flexGrow: 0` is what pins the row to
 * its own height; don't remove it.
 *
 * ── THE IDLE MOVEMENT ───────────────────────────────────────────────────────
 *
 * Every 7 seconds the row stirs, then goes still again. It exists to say "these
 * are live, tap one" without a banner saying so — the first thing a new user
 * misses is that the chips are buttons at all.
 *
 * IT IS FIVE MOVEMENTS, PICKED AT RANDOM — not one on a loop. A single gesture
 * repeating on a fixed clock is learnable within about three cycles, and once
 * you can predict it your eye stops going to it, which costs the animation the
 * entire job it was hired for. So each cycle draws a movement from the set (see
 * MOVEMENTS) and never draws the same one twice running: the row stays alive
 * without ever being anticipated.
 *
 * THE MOVEMENTS ARE DELIBERATELY DIFFERENT IN KIND, not in amplitude — a wave,
 * a shared swell, a run of light, a riffle, and a line of dominoes. Four
 * variations on "lift each chip in turn" would be one movement with a wardrobe.
 *
 * ── THE ROTATION: ONE HAND PER VISIT ────────────────────────────────────────
 *
 * FOUR CHIPS ARE SHOWN OUT OF A POOL OF TWENTY-ODD, and the four change BETWEEN
 * VISITS — never while you are looking at them. Leave the coach screen and the
 * next hand is dealt behind you; come back and it is already there.
 *
 * The hand used to change every time the row stirred, inside an opacity dip in
 * the middle of the movement. The owner switched that off (2026-10-15): a row
 * that swaps itself every seven seconds takes away the prompt somebody was
 * halfway through reading, and nobody can settle on a row that is never the
 * same twice. One hand per visit keeps what the rotation was for — eight fixed
 * chips looked like a menu, and a menu is something you read once and stop
 * seeing — without the row ever changing under someone. The idle movement
 * above is untouched; it simply no longer carries a swap.
 *
 * DEALT ON THE WAY OUT, NOT ON THE WAY IN. The next hand is dealt the moment
 * the screen loses focus, while it is hidden, so coming back never shows the
 * old prompts for a frame before the new ones land. The deck and the next hand
 * live at MODULE scope (`visits`), so this holds whether the screen stays
 * mounted as a tab or is rebuilt from scratch: a fresh mount picks up the hand
 * its predecessor dealt. The first visit of a session still opens on the
 * curated front of the pool.
 *
 * THE POOL IS DEALT, NOT SAMPLED. Draws come off a shuffled deck that excludes
 * what was just on screen and is only refilled when it runs out, so you work
 * through the whole pool instead of seeing the same three prompts recur — which
 * is what independent random picks actually do.
 *
 * IT IS ONE CLOCK, NOT N ANIMATIONS. The chips do not own timers. A single
 * linear `phase` sweeps 0→1 across the active window and each chip reads its
 * own displacement out of it against a phase offset of `index × stagger`. That
 * is what makes a crest a real thing travelling through the row rather than a
 * set of independent hops that merely start at different times — and the chips
 * cannot drift apart, because there is only one clock to drift.
 *
 * THE CLOCK ONLY RUNS WHILE SOMETHING IS MOVING. `phase` animates for the ~2.6s
 * of the movement and is then idle until the next cycle; it is not a permanent
 * 7-second linear timer burning a UI-thread animation for four still seconds.
 *
 * AND IT IS QUIET. The lift is 6pt with a 2% scale — an earlier pass moved
 * chips 13pt with a 6% scale on every cycle, which is a notification, not an
 * ambient tell. The character comes from which movement you get, not from how
 * far anything travels.
 *
 * ── THE HAND ON THE ROW ─────────────────────────────────────────────────────
 *
 * Touch the row and every bit of the above stops. `idleGain` rides to zero over
 * a few frames and the sweep is abandoned; a couple of seconds after your
 * finger settles it all fades back and the clock restarts.
 *
 * THAT IS TWO SEPARATE BUGS CLOSED WITH ONE VALUE. A row that keeps stirring
 * under a dragging finger fights the scroll for the same pixels. And the
 * end-of-row stack below needs a still stage to play on, or it is competing
 * with a wave for the same transforms.
 *
 * `idleGain` MULTIPLIES, IT DOES NOT SWITCH. Cutting the animation dead would
 * drop a mid-lift chip 6pt in one frame at the exact moment a finger lands on
 * it. The gain eases out, and only once it has reached zero — in the timing
 * callback, on the UI thread — is `phase` returned to rest, where it is
 * invisible to do so.
 *
 * ── THE END OF THE ROW ──────────────────────────────────────────────────────
 *
 * Scroll to either end and keep pulling, and the chips behave like objects
 * rather than like a list that has stopped. The row lags back against your
 * finger, and the chips bunch: each one slides toward the end you are pulling
 * against, tips alternately up and down as it runs out of room, and overlaps
 * its neighbour. Let go and the pile springs back into a straight row.
 *
 * THE PILE IS RANKED FROM THE END BEING PUSHED, not from the left of the list.
 * Rank 0 is the chip at that end — the one against the wall, which barely moves
 * — and the disorder grows behind it and then decays, so the fold is strongest
 * two or three chips back and the far end of a long pool is untouched. Pull the
 * other way and the ranking mirrors, because the wall has moved.
 *
 * WHY A PAN AND NOT `contentOffset`. iOS reports overscroll through a bouncing
 * scroll view; Android clamps it and paints an EdgeEffect glow instead, so
 * there is no number to read and the two platforms would need two different
 * implementations of the same effect. A `Pan` running SIMULTANEOUSLY with the
 * scroller's own recogniser (that is what `Gesture.Native()` buys — without it
 * RNGH cancels the scroll the moment our pan activates) measures the pull
 * itself, identically everywhere, on the UI thread. Both platforms' native end
 * behaviours are switched off so this is the only one.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { GozlinSuggestion } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type IconName = keyof typeof Ionicons.glyphMap;

/* ── The movements ────────────────────────────────────────────────────────
 * Numbers, not strings: the chips read this on the UI thread inside a worklet,
 * and a number comparison is the cheapest thing that crosses that boundary.
 */
const MOVE_WAVE = 0; // a crest of lift travels the row, left to right
const MOVE_BREATH = 1; // every chip swells together, no travel and no light
const MOVE_GLOW = 2; // light runs through the row; nothing moves
const MOVE_TILT = 3; // each chip rocks one way then the other, alternating
const MOVE_NUDGE = 4; // the first shoves the second, which shoves the third…
const MOVEMENTS = [
  MOVE_WAVE,
  MOVE_BREATH,
  MOVE_GLOW,
  MOVE_TILT,
  MOVE_NUDGE,
] as const;

/** Movement to movement. */
const CYCLE_MS = 7000;
/** First stir after the bar appears — sooner than a full cycle, so a new user sees it. */
const FIRST_DELAY_MS = 1200;
/**
 * How long `phase` runs. Generous enough for the crest to clear a long row
 * (stagger × chips + pulse) and then stop; chips past the window simply never
 * leave rest, which is the correct behaviour for a row you have to scroll.
 */
const SWEEP_MS = 2600;
/** How long a single chip spends rising and falling as the crest passes it. */
const PULSE_MS = 560;
/** How long the crest takes to travel from one chip to the next. */
const STAGGER_MS = 90;
/** The breath has no crest — every chip is on the same beat, so it can be slower. */
const BREATH_MS = 1500;
/**
 * The nudge is contact, so its timing is not free: the stagger is exactly the
 * time a chip takes to reach full extension (the SWING curve peaks at l≈0.22),
 * so the next chip starts moving at the instant its neighbour arrives. Shorten
 * this and chips move before they're touched; lengthen it and the row goes
 * limp between hits.
 */
const NUDGE_PULSE_MS = 640;
const NUDGE_STAGGER_MS = 140;

/** Peak lift, in points. */
const WAVE_LIFT = 6;
/** Peak scale-up at the crest. */
const WAVE_SCALE = 0.02;
/** Peak swell of the breath — no travel, so it can afford a touch more. */
const BREATH_SCALE = 0.03;
/** Peak rock of the tilt, in degrees, and the lift that rides with it. */
const TILT_DEG = 2.4;
const TILT_LIFT = 2.5;
/** How far a nudged chip travels into its neighbour, in points. */
const NUDGE_PX = 7;
/**
 * Max of `sin(πl) + LEAN·sin(2πl)`. The second term front-loads the curve so a
 * chip snaps up and eases down — the difference between a bounce and a float —
 * and this normalises the result back to a 0…1 range so the constants above
 * stay the literal peak travel.
 */
const WAVE_LEAN = 0.18;
const WAVE_PEAK = 1.057;
/**
 * Peak of the SIGNED curve `sin(2πl)·(1−l)^1.4` used by the tilt and the nudge.
 * A full sine period damped as it goes: a decisive shove out, a smaller
 * recoil past rest, then still — which is what a nudge and a rock both are,
 * and what the plain positive bump above can never be.
 */
const SWING_PEAK = 0.69;

/**
 * Fisher-Yates. In place on a copy, so the caller's pool is never reordered —
 * the front of it is the curated opening hand and must stay put.
 */
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Clearance above and below the row. Sized for the STACK, not for the idle
 * movement — a deeply-ranked chip at full pull lifts ~11pt and tips ~8°, and
 * Android's ScrollView clips its content, so a chip mid-fold would otherwise
 * lose a corner.
 */
const HEADROOM_TOP = 18;
const HEADROOM_BOTTOM = 16;

/**
 * How many of the pool are on screen at once.
 *
 * Four is what fits a phone's width without the fourth being a sliver. A fifth
 * was tried, on the theory that a row which always overflows is more obviously
 * scrollable; it bought a little of that and cost the thing that matters more —
 * at four, a full hand is legible at rest, which is what lets a new hand read as
 * a CHANGE when you come back rather than as something somewhere off the edge.
 * The row still scrolls, and the fold at its ends still says so.
 */
const VISIBLE_CHIPS = 4;

/* ── The hand, across visits ────────────────────────────────────────────── */

/**
 * Module scope on purpose — see "DEALT ON THE WAY OUT" in the header. A screen
 * that is torn down and rebuilt must still meet the hand dealt as it was left,
 * and must not start the deck over (which would bring the same prompts back
 * round long before the pool is spent).
 */
const visits: {
  /** The pool the two fields below were dealt from. A new pool starts over. */
  pool: GozlinSuggestion[] | null;
  /** What is left of the shuffled deck. Refilled only when it runs dry. */
  deck: GozlinSuggestion[];
  /** The hand to show on the next visit, dealt as the last one ended. */
  next: GozlinSuggestion[] | null;
} = { pool: null, deck: [], next: null };

/** Point the shared memory at `pool`, forgetting anything dealt from another. */
function adoptPool(pool: GozlinSuggestion[]): void {
  if (visits.pool === pool) return;
  visits.pool = pool;
  visits.deck = [];
  visits.next = null;
}

/** What a visit opens on: the hand dealt last time, else the curated front. */
function openingHand(pool: GozlinSuggestion[]): GozlinSuggestion[] {
  adoptPool(pool);
  return visits.next ?? pool.slice(0, VISIBLE_CHIPS);
}

/**
 * Deal the next hand off the shared deck, or null if the pool can't fill one.
 *
 * TWO PASSES, and the second one exists for a small pool. The first refuses
 * anything that was on screen — a prompt that survives a new visit reads as the
 * rotation having failed rather than as a fresh hand. But with only five or six
 * prompts in the pool there may not BE four fresh ones, and a single pass would
 * then deal nothing and freeze the row forever. So the second pass allows
 * repeats: a repeated chip is a blemish, a frozen row is a dead feature. Within
 * one hand a prompt can never appear twice either way.
 */
function dealFrom(
  pool: GozlinSuggestion[],
  current: GozlinSuggestion[],
): GozlinSuggestion[] | null {
  adoptPool(pool);
  if (pool.length <= VISIBLE_CHIPS) return null;
  const onScreen = new Set(current.map((s) => s.label));
  const hand: GozlinSuggestion[] = [];

  const draw = (allowHeld: boolean) => {
    // Bounded by construction: every iteration removes a card from the deck,
    // and a deck that empties is refilled at most a couple of times here.
    let guard = pool.length * 2 + 8;
    while (hand.length < VISIBLE_CHIPS && guard-- > 0) {
      if (visits.deck.length === 0) visits.deck = shuffle(pool);
      const next = visits.deck.pop();
      if (!next) break;
      if (hand.some((h) => h.label === next.label)) continue;
      if (!allowHeld && onScreen.has(next.label)) continue;
      hand.push(next);
    }
  };

  draw(false);
  if (hand.length < VISIBLE_CHIPS) draw(true);
  return hand.length === VISIBLE_CHIPS ? hand : null;
}

/** How long the idle motion takes to hand the stage over to a finger, and back. */
const GAIN_OUT_MS = 130;
const GAIN_IN_MS = 200;
/** Quiet time after a scroll settles before the row is allowed to stir again. */
const SETTLE_MS = 2200;

/* ── The stack ──────────────────────────────────────────────────────────── */

/** Asymptote of the pull, in points. It can never be reached, only approached. */
const PULL_MAX = 90;
/**
 * Resisted travel that counts as a full-strength fold.
 *
 * Tuned DOWN from 56 with the step above: the fold has to be at real strength
 * by the end of an ordinary firm drag, because the whole effect is chips
 * touching, and a pull that only ever reaches a third of the way leaves them
 * merely leaning at each other with daylight in between. 42 points of resisted
 * travel is about 80 of finger.
 */
const PULL_FULL = 42;
/**
 * How far the fold fades a chip's outline toward its own fill. Never 1 — see
 * the note on `edge` for why a fully dissolved border is worse than a bright one.
 */
const FOLD_EDGE_SOFT = 0.55;
/** How far the whole row lags behind the finger at full pull. */
const STACK_BAND = 22;
/**
 * How far each chip closes on the one ahead of it, at full pull, in points.
 *
 * THIS NUMBER IS THE WHOLE EFFECT, and getting it wrong is what made the first
 * pass look fake. The tuck was a 0…1 ramp scaled by 26pt, which saturated after
 * two chips: the first pair closed 15pt and every pair behind it closed 2–6.
 * So the row "compressed" while every chip kept a visible gap from its
 * neighbour — objects being crowded do not do that, and the eye reads the gap
 * long before it reads the motion.
 *
 * It is now a per-rank STEP rather than a normalised curve, so the closing is
 * roughly constant down the pile. `Spacing.sm` (8pt) of gap plus a real 15–18pt
 * of overlap means chips genuinely go UNDER each other. They touch, then they
 * stack, which is the thing that was asked for and the thing that makes a row
 * of buttons read as a row of objects.
 */
const STACK_STEP = 28;
/** Ranks over which the closing saturates, so a long row doesn't fly apart. */
const STACK_DEPTH = 6;
/** Peak vertical displacement of a folding chip. */
const STACK_LIFT = 12;
/** Peak tip of a folding chip, in degrees. */
const STACK_DEG = 8;
/** How much a folding chip compresses. */
const STACK_SQUASH = 0.05;
/** Rise-and-decay of the fold with rank, and the peak that normalises it to 1. */
const LEAN_RATE = 0.45;
const LEAN_PEAK = 0.8175;

/** Under-damped, so the pile springs back into a row and settles with one rebound. */
const SNAP_BACK = {
  damping: 13,
  stiffness: 210,
  mass: 0.55,
  restDisplacementThreshold: 0.002,
  restSpeedThreshold: 0.01,
} as const;

/** Horizontal travel before the pull is allowed to read as a pull. */
const PAN_ACTIVATE_X = 10;
/** Vertical travel that kills it outright, so the composer and list keep theirs. */
const PAN_FAIL_Y = 14;

/** Hyperbolic resistance: slope 1 at the origin, asymptotic to PULL_MAX. */
function resist(distance: number): number {
  "worklet";
  return (distance * PULL_MAX) / (distance + PULL_MAX);
}

export function GozlinSuggestionBar({
  suggestions,
  onPick,
  disabled,
  style,
}: {
  /**
   * THE POOL, not the row. Everything is drawn from here; the first
   * VISIBLE_CHIPS are what a new user sees, so order the front of this list
   * deliberately and let the rest be dealt.
   */
  suggestions: GozlinSuggestion[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
  /** Layout only — the caller's business (e.g. bleeding past a padded parent). */
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const reduceMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // THE one clock. A linear 0→1 sweep per movement; every chip's motion is a
  // pure function of it, which is what makes the crest continuous.
  const phase = useSharedValue(0);
  /** Which of MOVEMENTS is playing. Set on the JS side just before each sweep. */
  const movement = useSharedValue<number>(MOVE_WAVE);
  /** The last one drawn, so we can refuse to draw it twice in a row. */
  const lastMovement = useRef<number>(-1);
  /**
   * How much of the idle motion is being expressed, 0…1. Rides to zero the
   * moment a finger lands on the row and back to one once it settles.
   */
  const idleGain = useSharedValue(1);

  // ── The pull at the ends ──
  const offsetX = useSharedValue(0);
  const maxOffsetX = useSharedValue(0);
  const viewportW = useSharedValue(0);
  const contentW = useSharedValue(0);
  /** Signed fold strength: −1 pulling past the left end, +1 past the right. */
  const squeeze = useSharedValue(0);
  /** Finger position the current stretch is measured from. */
  const anchorX = useSharedValue(0);
  /** 0 = the row is scrolling, +1 = folding at the right end, −1 = at the left. */
  const latch = useSharedValue(0);

  /**
   * The four on screen: whatever the last visit dealt on its way out, or —
   * on the first visit of a session — the curated front of the pool.
   */
  const [shown, setShown] = useState<GozlinSuggestion[]>(() => openingHand(suggestions));
  /** Read inside the blur handler without re-subscribing the focus effect. */
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // A pool that changes identity after mount re-seeds the row rather than
  // leaving stale chips on it. (The first render already opened on this pool.)
  const poolRef = useRef(suggestions);
  useEffect(() => {
    if (poolRef.current === suggestions) return;
    poolRef.current = suggestions;
    setShown(openingHand(suggestions));
  }, [suggestions]);

  /**
   * THE ROTATION. Nothing happens while the screen is in view; the cleanup is
   * the moment it is left, and that is when the next hand is dealt — behind
   * the user's back, so the return opens on it. The row is also put back to
   * its start: a new hand is a new offer, and an offer that comes back already
   * scrolled past its first two prompts has hidden the part that was curated.
   *
   * The pool is read through `poolRef`, not captured: a callback that depended
   * on it would re-run the focus effect when the pool changed, and its cleanup
   * would deal a new hand in plain view.
   */
  useFocusEffect(
    useCallback(
      () => () => {
        const hand = dealFrom(poolRef.current, shownRef.current);
        if (!hand) return;
        visits.next = hand;
        setShown(hand);
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      },
      [scrollRef],
    ),
  );

  /* ── A hand on the row ────────────────────────────────────────────────── */

  const [held, setHeld] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginHold = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setHeld(true);
  }, []);

  const endHold = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setHeld(false), SETTLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  /**
   * Hand the stage over, and take it back.
   *
   * The sweep is abandoned rather than reversed, and `phase` is only returned
   * to rest INSIDE the timing callback — i.e. once the gain has actually
   * reached zero and nothing is visible to jump. Doing it eagerly is what makes
   * a chip drop out from under a finger that has just touched it.
   */
  useEffect(() => {
    if (held) {
      cancelAnimation(phase);
      idleGain.value = withTiming(0, { duration: GAIN_OUT_MS }, (done) => {
        if (done) phase.value = 0;
      });
      return;
    }
    idleGain.value = withTiming(1, { duration: GAIN_IN_MS });
  }, [held, idleGain, phase]);

  /* ── The idle movement ────────────────────────────────────────────────── */

  useEffect(() => {
    // A row of chips dancing under a "Typing…" status is the app fidgeting at
    // someone who is waiting for it; idle motion is exactly what reduce-motion
    // asks us not to do; and a row stirring under a dragging finger fights the
    // scroll for the same pixels.
    if (disabled || reduceMotion || held) {
      cancelAnimation(phase);
      if (disabled || reduceMotion) phase.value = 0;
      return;
    }

    /**
     * Draw a movement, never the one just played.
     *
     * Sampling from the remaining four (rather than re-rolling until it
     * differs) keeps this to a single call with no worst case, and it's what
     * makes the row unpredictable rather than merely varied: a plain random
     * pick repeats about a fifth of the time, and a repeat is the one thing
     * that reads as "stuck".
     */
    const nextMovement = (): number => {
      const pool = MOVEMENTS.filter((m) => m !== lastMovement.current);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      lastMovement.current = pick;
      return pick;
    };

    const play = () => {
      movement.value = nextMovement();
      phase.value = 0;
      phase.value = withTiming(1, { duration: SWEEP_MS, easing: Easing.linear });
    };

    const first = setTimeout(play, FIRST_DELAY_MS);
    const every = setInterval(play, CYCLE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      cancelAnimation(phase);
    };
  }, [phase, movement, disabled, reduceMotion, held]);

  /* ── Where the row is, and how far it can go ──────────────────────────── */

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offsetX.value = e.contentOffset.x;
      maxOffsetX.value = Math.max(
        0,
        e.contentSize.width - e.layoutMeasurement.width,
      );
    },
    onBeginDrag: () => runOnJS(beginHold)(),
    onEndDrag: () => runOnJS(endHold)(),
    onMomentumEnd: () => runOnJS(endHold)(),
  });

  // Seeded from layout as well as from scrolling, so "is this row already at
  // its end?" is answerable before anyone has scrolled it — which is the case
  // for every row short enough to fit.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewportW.value = e.nativeEvent.layout.width;
      maxOffsetX.value = Math.max(0, contentW.value - viewportW.value);
    },
    [viewportW, contentW, maxOffsetX],
  );

  const onContentSizeChange = useCallback(
    (w: number) => {
      contentW.value = w;
      maxOffsetX.value = Math.max(0, w - viewportW.value);
    },
    [contentW, viewportW, maxOffsetX],
  );

  /* ── The pull at the ends ─────────────────────────────────────────────── */

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-PAN_ACTIVATE_X, PAN_ACTIVATE_X])
      .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
      // Measure the stretch from where the finger was when the pan ACTIVATED,
      // not from touch-down — otherwise the activation slop itself would appear
      // as an instant jump of fold.
      .onStart((e) => {
        anchorX.value = e.translationX;
        latch.value = 0;
        runOnJS(beginHold)();
      })
      .onUpdate((e) => {
        if (latch.value === 0) {
          const d = e.translationX - anchorX.value;
          const atLeft = offsetX.value <= 0.5;
          const atRight =
            maxOffsetX.value <= 0.5 || offsetX.value >= maxOffsetX.value - 0.5;

          // Dragging right with nothing to the left, or left with nothing to
          // the right, is the only way into the fold.
          if (d > 0 && atLeft) latch.value = -1;
          else if (d < 0 && atRight) latch.value = 1;
          else {
            // Still scrolling. Keep the anchor glued to the finger so the fold
            // starts from zero the moment the row runs out of room, however far
            // the finger has already travelled.
            anchorX.value = e.translationX;
            if (squeeze.value !== 0) squeeze.value = 0;
            return;
          }
        }

        const dir = latch.value;
        // Positive whenever the finger is still pushing further past the end.
        const stretch = (e.translationX - anchorX.value) * -dir;
        if (stretch <= 0) {
          // Dragged back to where the fold began — hand the row its scroll
          // back, exactly at zero, so there is nothing to snap.
          latch.value = 0;
          anchorX.value = e.translationX;
          squeeze.value = 0;
          return;
        }
        squeeze.value = dir * Math.min(1, resist(stretch) / PULL_FULL);
      })
      // `onFinalize`, not `onEnd`: a fold that gets cancelled (a gesture higher
      // up claims the touch) must still spring home rather than stay folded.
      .onFinalize(() => {
        latch.value = 0;
        if (squeeze.value !== 0) squeeze.value = withSpring(0, SNAP_BACK);
        runOnJS(endHold)();
      });

    // The scroller's own native recogniser, declared as a peer rather than a
    // rival. Without this the pan's activation cancels the scroll outright.
    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [disabled, anchorX, latch, offsetX, maxOffsetX, squeeze, beginHold, endHold]);

  if (!suggestions.length) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.bar, style]}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        // Both platforms' own end behaviours are off: the fold is the end
        // behaviour, and two of them at once would double the travel on iOS and
        // paint an EdgeEffect over it on Android.
        bounces={false}
        overScrollMode={Platform.OS === "android" ? "never" : undefined}
      >
        {shown.map((s, i) => (
          <Chip
            key={s.label}
            suggestion={s}
            index={i}
            count={shown.length}
            phase={phase}
            movement={movement}
            idleGain={idleGain}
            squeeze={squeeze}
            disabled={disabled}
            onPick={onPick}
            colors={colors}
          />
        ))}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

function Chip({
  suggestion,
  index,
  count,
  phase,
  movement,
  idleGain,
  squeeze,
  disabled,
  onPick,
  colors,
}: {
  suggestion: GozlinSuggestion;
  index: number;
  /** How many chips are in the row — the fold ranks from the far end. */
  count: number;
  phase: SharedValue<number>;
  movement: SharedValue<number>;
  idleGain: SharedValue<number>;
  squeeze: SharedValue<number>;
  disabled?: boolean;
  onPick: (prompt: string) => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  /**
   * How far into its OWN pulse the current movement has carried this chip.
   * Below 0 the crest hasn't reached it; above 1 it has already passed. That
   * window is what leaves the row genuinely still between cycles instead of
   * permanently shimmering.
   *
   * The breath is the one movement with no stagger — every chip shares the
   * same beat, which is precisely what makes it feel like one object rather
   * than a row of them. The nudge has a stagger of its own, tuned to contact.
   */
  const local = useDerivedValue(() => {
    const elapsed = phase.value * SWEEP_MS;
    const m = movement.value;
    if (m === MOVE_BREATH) return elapsed / BREATH_MS;
    const isNudge = m === MOVE_NUDGE;
    const stagger = isNudge ? NUDGE_STAGGER_MS : STAGGER_MS;
    const pulse = isNudge ? NUDGE_PULSE_MS : PULSE_MS;
    return (elapsed - index * stagger) / pulse;
  });

  /** The positive bump — rise and fall. Wave, breath, glow. */
  const bump = useDerivedValue(() => {
    const l = local.value;
    if (l <= 0 || l >= 1) return 0;
    const a = Math.sin(l * Math.PI);
    const b = Math.sin(l * Math.PI * 2);
    return (a + WAVE_LEAN * b) / WAVE_PEAK;
  });

  /** The signed swing — out, back past rest, still. Tilt and nudge. */
  const swing = useDerivedValue(() => {
    const l = local.value;
    if (l <= 0 || l >= 1) return 0;
    return (Math.sin(l * Math.PI * 2) * Math.pow(1 - l, 1.4)) / SWING_PEAK;
  });

  /**
   * Which way this chip rocks. Alternating by position turns the tilt from
   * "every chip leans the same way in turn" — which is a wave wearing a
   * different hat — into a riffle running down the row.
   */
  const tiltDir = index % 2 === 0 ? 1 : -1;

  const motionStyle = useAnimatedStyle(() => {
    const m = movement.value;
    const g = idleGain.value;
    const b = bump.value * g;
    const s = swing.value * g;

    // ── The idle movement ──
    const idleX = m === MOVE_NUDGE ? s * NUDGE_PX : 0;
    const idleY =
      m === MOVE_WAVE
        ? -b * WAVE_LIFT
        : m === MOVE_TILT
          ? -Math.abs(s) * TILT_LIFT
          : 0;
    const idleScale =
      m === MOVE_WAVE
        ? 1 + b * WAVE_SCALE
        : m === MOVE_BREATH
          ? 1 + b * BREATH_SCALE
          : 1;
    const idleDeg = m === MOVE_TILT ? s * TILT_DEG * tiltDir : 0;

    // ── The fold at the end of the row ──
    //
    // Rank is measured from the end being pushed against, so the wall chip
    // barely moves and the pile builds behind it. `tuck` is CUMULATIVE — chip
    // n closes on chip n−1, which has already closed on n−2 — with a soft
    // saturation so a long row doesn't fly apart. That is what makes chips
    // actually meet and overlap instead of sliding a token amount and stopping
    // with daylight still between them.
    //
    // `lean` rises and decays, which is what puts the worst of the disorder two
    // or three chips back rather than at the edge, and leaves a long row calm
    // beyond that.
    const sq = squeeze.value;
    let foldX = 0;
    let foldY = 0;
    let foldDeg = 0;
    let foldScale = 1;
    if (sq > 0.002 || sq < -0.002) {
      const strength = sq > 0 ? sq : -sq;
      const dir = sq > 0 ? 1 : -1; // +1 = folding at the right end
      const rank = dir > 0 ? count - 1 - index : index;
      const tuck = STACK_STEP * STACK_DEPTH * (1 - Math.exp(-rank / STACK_DEPTH));
      const lean = (rank * Math.exp(-rank * LEAN_RATE)) / LEAN_PEAK;
      // Alternating from the wall outwards: the first chip behind it folds
      // down, the next up, and so on — a riffle, not a ramp.
      const alt = rank % 2 === 1 ? 1 : -1;

      foldX = strength * dir * (tuck - STACK_BAND);
      foldY = strength * lean * STACK_LIFT * alt;
      foldDeg = strength * lean * STACK_DEG * alt;
      foldScale = 1 - strength * lean * STACK_SQUASH;
    }

    return {
      transform: [
        { translateX: idleX + foldX },
        { translateY: idleY + foldY },
        { rotate: `${idleDeg + foldDeg}deg` },
        { scale: idleScale * foldScale },
      ],
    };
  });

  // Both endpoints are resolved HERE, on the JS thread. `alpha()` is an
  // ordinary function; calling it inside the worklet would try to run JS
  // synchronously on the UI thread and throw. Only `interpolateColor` (which is
  // itself a worklet) may cross the boundary.
  const restBorder = colors.border;
  const litBorder = alpha(colors.primary, 0.55);
  const restPlate = alpha(colors.primary, 0.12);
  const litPlate = alpha(colors.primary, 0.3);
  /**
   * The chip's fill, and the direction its outline fades in. `surfaceElevated`
   * equals `surface` in the light theme, so the fill lift is a real depth cue
   * in dark and a no-op in light — which is correct rather than unfortunate:
   * white cards on white do not get darker when you stack them, they get an
   * edge, and that is what `edge` above preserves.
   */
  const restFill = colors.surface;
  const foldFill = colors.surfaceElevated;
  const softBorder = colors.surface;

  /**
   * Light is the whole point of the glow and merely a garnish on the others, so
   * it rides at full strength there and at a third elsewhere. Without that
   * split the glow would be indistinguishable from the wave with the movement
   * subtracted — which is to say, indistinguishable from nothing.
   *
   * THE BREATH GETS NONE. It is the one movement whose whole character is that
   * the row swells as a single object and nothing else happens; any light at
   * all turns it into a dimmer version of the glow. `Math.max` guards the
   * signed swing, whose recoil goes negative and would otherwise drive the
   * colour interpolation backwards past its rest value.
   *
   * THE FOLD IS NOT ON THIS CHANNEL. It used to be — a folding chip lit its
   * border up, on the theory that contact should be visible in more than
   * geometry. In the hand it did the opposite: chips that are OVERLAPPING each
   * other, each ringed in a bright 1pt line, produce a mess of crossing edges
   * exactly where the eye is trying to read one object in front of another, and
   * a rotated 1pt stroke is the least forgiving thing on the screen. See `edge`
   * below for what replaced it.
   */
  const glow = useDerivedValue(() => {
    const g = idleGain.value;
    const m = movement.value;
    if (m === MOVE_BREATH) return 0;
    if (m === MOVE_GLOW) return bump.value * g;
    const v =
      m === MOVE_TILT || m === MOVE_NUDGE ? Math.abs(swing.value) : bump.value;
    return Math.max(0, v) * g * 0.35;
  });

  /** How hard this chip is being crowded, 0…1. Unsigned — either end folds. */
  const fold = useDerivedValue(() => {
    const sq = squeeze.value;
    return sq > 0 ? sq : -sq;
  });

  /**
   * ── HOW A FOLDING CHIP IS DRAWN ─────────────────────────────────────────
   *
   * Stacked objects are separated by TONE, never by outline. As the pile closes
   * up, each chip's border dissolves into its own raised fill and the fill
   * itself lifts to `surfaceElevated` — so what overlaps is a solid shape on a
   * slightly darker shape, the way one card sitting on another actually looks.
   * The alternative, which is what shipped first, is a lattice of hairlines
   * crossing at angles, and no amount of easing rescues that.
   *
   * ONE SIGNED DRIVER, THREE STOPS. Glow pulls the border toward the lit
   * accent; fold pulls it the other way toward the fill. They can't both be
   * true at once (the idle motion is off while a finger is on the row), so a
   * single `glow − fold` value carries both without two interpolations
   * fighting over the same property.
   *
   * IT SOFTENS, IT DOES NOT VANISH — hence `FOLD_EDGE_SOFT` rather than a full
   * −1. In the light theme `surface` and `surfaceElevated` are the same white,
   * so a border taken all the way to the fill would leave overlapping chips as
   * one merged white blob with no shape at all. Stopping the fade partway
   * leaves a quiet line: enough to say where one chip ends and the next begins,
   * far too little to build a lattice out of.
   *
   * The chips' fills are OPAQUE either way, which is what actually does the
   * occluding — one chip genuinely covers the one it slides over. The border is
   * only there to draw its silhouette.
   */
  const edge = useDerivedValue(() => glow.value - fold.value * FOLD_EDGE_SOFT);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      edge.value,
      [-1, 0, 1],
      [softBorder, restBorder, litBorder],
    ),
    backgroundColor: interpolateColor(fold.value, [0, 1], [restFill, foldFill]),
  }));
  const plateStyle = useAnimatedStyle(() => ({
    // The icon plate keeps the pressure reading the border gave up: it is an
    // interior fill, so it can brighten under crowding without adding an edge.
    backgroundColor: interpolateColor(
      Math.max(glow.value, fold.value * 0.55),
      [0, 1],
      [restPlate, litPlate],
    ),
  }));

  return (
    <Animated.View style={[styles.chipWrap, motionStyle]}>
      <Pressable
        disabled={disabled}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPick(suggestion.prompt);
        }}
        accessibilityRole="button"
        accessibilityLabel={suggestion.label}
        accessibilityHint="Asks your coach this"
        style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        {/* `borderStyle` owns both the outline AND the fill — they move
            together as the pile closes up, so the chip never spends a frame
            with a dissolved edge over an un-raised surface. */}
        <Animated.View style={[styles.chip, borderStyle]}>
          <Animated.View style={[styles.iconWrap, plateStyle]}>
            <Ionicons name={suggestion.icon as IconName} size={14} color={colors.primary} />
          </Animated.View>
          <AppText
            variant="footnote"
            weight="600"
            numberOfLines={1}
            style={[styles.label, { color: colors.text }]}
          >
            {suggestion.label}
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Undoes ScrollView's inherited `flexGrow: 1` — see the header note. */
  bar: { flexGrow: 0, flexShrink: 0 },
  row: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    // Clearance for the fold's lift and tipped corners — Android clips
    // ScrollView content, so a folding chip would otherwise lose its top.
    paddingTop: HEADROOM_TOP,
    paddingBottom: HEADROOM_BOTTOM,
    alignItems: "center",
  },
  /** Carries the movement. Holds the chip's no-compress contract at the outer edge. */
  chipWrap: { flexShrink: 0, flexGrow: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    // Critical: never let a chip be squeezed by its neighbours — scroll instead.
    flexShrink: 0,
    flexGrow: 0,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flexShrink: 0 },
});
