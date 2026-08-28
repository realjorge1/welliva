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
 * ── THE ROTATION ────────────────────────────────────────────────────────────
 *
 * FOUR CHIPS ARE SHOWN OUT OF A POOL OF TWENTY-ODD, and the four change every
 * time the row stirs. Eight fixed chips looked like a menu, and a menu is
 * something you read once and stop seeing — by the third session they were
 * furniture, and a chip nobody looks at is a chip nobody taps.
 *
 * THE MOVEMENT IS THE CHANGE, not a cue that a change is coming. The row dips
 * its opacity for about a third of a second in the middle of the sweep, the
 * four prompts are swapped inside that dip, and the movement carries on to its
 * end. So there is no separate transition to design or to sit through: the
 * thing that was already drawing your eye is the thing that hands you new
 * prompts, and you look back at a row that has quietly become different.
 *
 * ALL FOUR SWAP TOGETHER, on one instant, even under a staggered movement like
 * the wave. Swapping each chip as the crest reached it would be prettier for
 * exactly one cycle and then wrong forever: a chip's width follows its label,
 * so a stagger means chips resizing while their neighbours are fully visible,
 * and the row jitters sideways. One instant, everything invisible, one relayout.
 *
 * THE POOL IS DEALT, NOT SAMPLED. Draws come off a shuffled deck that excludes
 * what is currently on screen and is only refilled when it runs out, so you
 * work through the whole pool instead of seeing the same three prompts
 * recur — which is what independent random picks actually do.
 *
 * IT ONLY ROTATES WHILE THE ROW IS ALIVE. Reduce-motion and the thinking state
 * both stop the clock, and the prompts stop with it — swapping them silently
 * under someone who asked for less motion is the same request, ignored.
 *
 * IT IS ONE CLOCK, NOT N ANIMATIONS. The chips do not own timers. A single
 * linear `phase` sweeps 0→1 across the active window and each chip reads its
 * own displacement out of it against a phase offset of `index × stagger`. That
 * is what makes a crest a real thing travelling through the row rather than a
 * set of independent hops that merely start at different times — and the chips
 * cannot drift apart, because there is only one clock to drift.
 *
 * THE CLOCK ONLY RUNS WHILE SOMETHING IS MOVING. `phase` animates for the ~1.5s
 * of the movement and is then idle until the next cycle; it is not a permanent
 * 7-second linear timer burning a UI-thread animation for six still seconds.
 *
 * AND IT IS QUIET. The lift is 6pt with a 2% scale — the previous pass moved
 * chips 13pt with a 6% scale on every cycle, which is a notification, not an
 * ambient tell. The character comes from which movement you get, not from how
 * far anything travels.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { GozlinSuggestion } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
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

/** Headroom above the row so a lifting or tilting chip is never clipped. */
const MOTION_HEADROOM = 10;

/**
 * How many of the pool are on screen at once. Four is what fits a phone width
 * without the fourth being a sliver — the row still scrolls, but a full set is
 * visible at rest, which is what makes a rotation legible as a change.
 */
const VISIBLE_CHIPS = 4;
/** Where in the sweep the prompts change, as a fraction of it. */
const SWAP_AT = 0.36;
/** Half-width of the dip around that instant, in the same units. */
const SWAP_HALF = 0.09;
/** How far down the dip goes. Not to zero: a row that vanishes reads as a bug. */
const SWAP_FADE = 0.88;

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

  // THE one clock. A linear 0→1 sweep per movement; every chip's motion is a
  // pure function of it, which is what makes the crest continuous.
  const phase = useSharedValue(0);
  /** Which of MOVEMENTS is playing. Set on the JS side just before each sweep. */
  const movement = useSharedValue<number>(MOVE_WAVE);
  /** The last one drawn, so we can refuse to draw it twice in a row. */
  const lastMovement = useRef<number>(-1);

  /**
   * The four on screen. Seeded from the front of the pool so the first thing a
   * new user sees is the curated set, not a random hand.
   */
  const [shown, setShown] = useState<GozlinSuggestion[]>(() =>
    suggestions.slice(0, VISIBLE_CHIPS),
  );
  /** What is left of the shuffled deck. Refilled only when it runs dry. */
  const deck = useRef<GozlinSuggestion[]>([]);
  /** Read inside the swap callback without making the clock depend on it. */
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // A pool that changes identity (or a screen that mounts with fewer prompts
  // than fit) re-seeds the row rather than leaving stale chips on it.
  useEffect(() => {
    deck.current = [];
    setShown(suggestions.slice(0, VISIBLE_CHIPS));
  }, [suggestions]);

  const rotates = suggestions.length > VISIBLE_CHIPS;

  /**
   * Deal the next four.
   *
   * TWO PASSES, and the second one exists for a small pool. The first refuses
   * anything currently on screen — a prompt that survives a swap reads as the
   * animation having failed rather than as a rotation. But with only five or
   * six prompts in the pool there may not BE four fresh ones, and a single
   * pass would then deal nothing and freeze the row forever. So the second
   * pass allows repeats: a repeated chip is a blemish, a frozen row is a dead
   * feature. Within one hand a prompt can never appear twice either way.
   */
  const dealNext = useCallback(() => {
    const held = new Set(shownRef.current.map((s) => s.label));
    const hand: GozlinSuggestion[] = [];

    const draw = (allowHeld: boolean) => {
      // Bounded by construction: every iteration removes a card from the deck,
      // and a deck that empties is refilled at most a couple of times here.
      let guard = suggestions.length * 2 + 8;
      while (hand.length < VISIBLE_CHIPS && guard-- > 0) {
        if (deck.current.length === 0) deck.current = shuffle(suggestions);
        const next = deck.current.pop();
        if (!next) break;
        if (hand.some((h) => h.label === next.label)) continue;
        if (!allowHeld && held.has(next.label)) continue;
        hand.push(next);
      }
    };

    draw(false);
    if (hand.length < VISIBLE_CHIPS) draw(true);

    // Still short — the pool cannot fill a row at all. Keep what is up rather
    // than rendering a gap.
    if (hand.length === VISIBLE_CHIPS) setShown(hand);
  }, [suggestions]);

  useEffect(() => {
    // A row of chips dancing under a "Typing…" status is the app fidgeting at
    // someone who is waiting for it — and idle motion is exactly what
    // reduce-motion asks us not to do.
    if (disabled || reduceMotion) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    /**
     * Draw a movement, never the one just played.
     *
     * Sampling from the remaining three (rather than re-rolling until it
     * differs) keeps this to a single call with no worst case, and it's what
     * makes the row unpredictable rather than merely varied: a plain random
     * pick repeats about a quarter of the time, and a repeat is the one thing
     * that reads as "stuck".
     */
    const nextMovement = (): number => {
      const pool = MOVEMENTS.filter((m) => m !== lastMovement.current);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      lastMovement.current = pick;
      return pick;
    };

    // One swap timer, replaced each cycle. The dip that hides the change is
    // computed from `phase` on the UI thread; this only has to land inside it,
    // and the dip is ~300ms wide, so timer jitter is invisible.
    let swapAt: ReturnType<typeof setTimeout> | undefined;

    const play = () => {
      movement.value = nextMovement();
      phase.value = 0;
      phase.value = withTiming(1, { duration: SWEEP_MS, easing: Easing.linear });
      if (rotates) {
        clearTimeout(swapAt);
        swapAt = setTimeout(dealNext, SWEEP_MS * SWAP_AT);
      }
    };

    const first = setTimeout(play, FIRST_DELAY_MS);
    const every = setInterval(play, CYCLE_MS);
    return () => {
      clearTimeout(first);
      clearTimeout(swapAt);
      clearInterval(every);
      cancelAnimation(phase);
    };
  }, [phase, movement, disabled, reduceMotion, rotates, dealNext]);

  if (!suggestions.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.bar, style]}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      {shown.map((s, i) => (
        <Chip
          key={s.label}
          suggestion={s}
          index={i}
          phase={phase}
          movement={movement}
          swapping={rotates}
          disabled={disabled}
          onPick={onPick}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  suggestion,
  index,
  phase,
  movement,
  swapping,
  disabled,
  onPick,
  colors,
}: {
  suggestion: GozlinSuggestion;
  index: number;
  phase: SharedValue<number>;
  movement: SharedValue<number>;
  /** The row rotates its prompts — dip for the swap. False for a fixed row. */
  swapping: boolean;
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

  /**
   * The dip that hides the prompt change: a cosine bell centred on SWAP_AT.
   * Every chip computes the same number off the same clock, so all four go
   * dark together and the relayout happens where nobody can see it.
   */
  const swapFade = useDerivedValue(() => {
    if (!swapping) return 1;
    const d = Math.abs(phase.value - SWAP_AT);
    if (d >= SWAP_HALF) return 1;
    return 1 - SWAP_FADE * 0.5 * (1 + Math.cos((d / SWAP_HALF) * Math.PI));
  }, [swapping]);

  const motionStyle = useAnimatedStyle(() => {
    const m = movement.value;
    const b = bump.value;
    const s = swing.value;
    return {
      opacity: swapFade.value,
      transform: [
        // The nudge is the only movement that travels sideways — it's a shove
        // into the next chip, so of course it does.
        { translateX: m === MOVE_NUDGE ? s * NUDGE_PX : 0 },
        {
          translateY:
            m === MOVE_WAVE
              ? -b * WAVE_LIFT
              : m === MOVE_TILT
                ? -Math.abs(s) * TILT_LIFT
                : 0,
        },
        {
          scale:
            m === MOVE_WAVE
              ? 1 + b * WAVE_SCALE
              : m === MOVE_BREATH
                ? 1 + b * BREATH_SCALE
                : 1,
        },
        { rotate: m === MOVE_TILT ? `${s * TILT_DEG * tiltDir}deg` : "0deg" },
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
   */
  const glow = useDerivedValue(() => {
    const m = movement.value;
    if (m === MOVE_BREATH) return 0;
    if (m === MOVE_GLOW) return bump.value;
    const v = m === MOVE_TILT || m === MOVE_NUDGE ? Math.abs(swing.value) : bump.value;
    return Math.max(0, v) * 0.35;
  });

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(glow.value, [0, 1], [restBorder, litBorder]),
  }));
  const plateStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(glow.value, [0, 1], [restPlate, litPlate]),
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
        <Animated.View
          style={[styles.chip, { backgroundColor: colors.surface }, borderStyle]}
        >
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
    // Clearance for the lift and the tilt's raised corner — Android clips
    // ScrollView content, so a chip at its peak would otherwise lose its top.
    paddingTop: MOTION_HEADROOM,
    paddingBottom: Spacing.sm,
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
