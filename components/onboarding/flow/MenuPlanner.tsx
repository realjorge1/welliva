/**
 * MenuPlanner — "how should we plan your meals?", and if the answer is "let me
 * choose", the choosing.
 *
 * FIVE BEATS IN ONE STEP, like the food step's three questions: the choice,
 * then breakfast, lunch and dinner, then how long. They replace each other in
 * one region (CrossFade) under a small tab rail that says where you are and
 * lets you go back to any beat already visited.
 *
 * WHY IT DOES NOT FEEL LIKE A FORM
 *  • The first answer is a real preview, not a promise. "Plan them for me"
 *    shows the dishes it would actually serve, cycling through the coming days
 *    — the user sees their cuisine arrive before they have chosen anything.
 *  • A dish is picked, never scheduled. Picks rotate across the week by
 *    themselves and the week draws itself above the list as they do. Assigning
 *    days is optional and is done by tapping the picture of the week.
 *  • Nothing is required. An empty chapter is "Gozlin picks", said on the
 *    button, so skipping is a choice the interface names rather than a gap it
 *    silently fills.
 *  • Long lists get quick cuts ("Rice", "Beans", "Soup") drawn from the dishes
 *    actually present, so a chip never leads to an empty list.
 *
 * PRESENTATION ONLY. The dishes, the rotation, the portion each row quotes and
 * everything saved live in the step and in services/nutrition/menuBuilder.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { Dish, MainSlot, MenuDraft, MenuLength } from "@/services/nutrition/menuBuilder";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AnimatedText } from "./AnimatedText";
import { OPTIONS_DELAY } from "./AnimatedQuestion";
import { Appear } from "./Appear";
import { CrossFade } from "./CrossFade";
import { MultiSelectGrid, type GridOption } from "./MultiSelectGrid";
import { OnboardingGlyph, type GlyphName } from "./OnboardingGlyph";
import { selectHaptic } from "./SelectionCard";
import { DAY_NAMES, WeekStrip, type WeekMark } from "./WeekStrip";
import { Dur, Ease, Spring, Stagger, Travel, useMotion } from "./onboardingMotion";
import { HIT, MIN_TOUCH, Rhythm } from "./onboardingTheme";

/* ───────────────────────────── Shared vocabulary ───────────────────────── */

export type MenuMode = "auto" | "choose";

const SLOT_OF_PHASE: Record<number, MainSlot> = { 1: "breakfast", 2: "lunch", 3: "dinner" };

const SLOT_COPY: Record<MainSlot, { title: string; support: string; noun: string; glyph: GlyphName }> = {
  breakfast: {
    title: "Which breakfasts do you love?",
    support: "Pick a few. I’ll rotate them through your week and size each one to your morning.",
    noun: "breakfasts",
    glyph: "sunrise",
  },
  lunch: {
    title: "And for lunch?",
    support: "The ones you’d happily have again. Tap a day above to move things around.",
    noun: "lunches",
    glyph: "spark",
  },
  dinner: {
    title: "Last one — dinner.",
    support: "Light or hearty, your call. Anything you leave open, Gozlin fills.",
    noun: "dinners",
    glyph: "moon",
  },
};

/** The same three questions for a plan of one day: one dish each, nothing to rotate. */
const ONE_DAY_COPY: Record<MainSlot, { title: string; support: string }> = {
  breakfast: {
    title: "Which breakfast today?",
    support: "Pick one and I’ll size it to your morning. Tap another to change your mind.",
  },
  lunch: {
    title: "And for lunch?",
    support: "One dish, sized to your afternoon — or leave it to Gozlin.",
  },
  dinner: {
    title: "Last one — dinner.",
    support: "Light or hearty, your call. Leave it open and Gozlin fills it.",
  },
};

const TABS = ["Breakfast", "Lunch", "Dinner", "How long"];
const MEAL_TABS = TABS.slice(0, 3);

const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * One colour per pick, in pick order, drawn from the app's data-viz hues so a
 * dish reads as the same thing in the list, on the week, and on the summary.
 */
function pickTones(colors: ReturnType<typeof useColors>["colors"]): string[] {
  return [colors.primary, colors.protein, colors.water, colors.fat, colors.calories, colors.error];
}

/** "Akara + Pap" → "AP"; "Beans Porridge" → "BP"; "Moi-Moi" → "MM". */
export function monogram(title: string): string {
  const words = title
    .split(/[\s+&,/-]+/)
    .filter((w) => w && !/^(with|and|of|the|a|small|large)$/i.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join("") || title.slice(0, 2).toUpperCase();
}

function daysLine(days: number[]): string {
  if (days.length === 0) return "Not on any day yet — tap a day above";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && days.every((d) => d < 5)) return "Weekdays";
  if (days.length === 2 && days.includes(5) && days.includes(6)) return "Weekends";
  return days.map((d) => DAY_NAMES[d]!.slice(0, 3)).join(" · ");
}

/* ──────────────────────────────── Tab rail ─────────────────────────────── */

function MenuTabs({
  phase,
  reached,
  counts,
  onJump,
  tabs = TABS,
}: {
  phase: number;
  reached: number;
  counts: number[];
  onJump: (phase: number) => void;
  tabs?: readonly string[];
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const [boxes, setBoxes] = useState<{ x: number; w: number }[]>([]);
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  const active = phase - 1;
  const box = boxes[active];
  useEffect(() => {
    if (!box) return;
    if (w.value === 0 || motion.reduced) {
      x.value = box.x;
      w.value = box.w;
    } else {
      x.value = withSpring(box.x, Spring.settle);
      w.value = withSpring(box.w, Spring.settle);
    }
  }, [box, motion.reduced, x, w]);

  const bar = useAnimatedStyle(() => ({
    width: w.value,
    transform: [{ translateX: x.value }],
    opacity: w.value > 0 ? 1 : 0,
  }));

  const onLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setBoxes((prev) => {
      const next = [...prev];
      next[i] = { x: lx, w: width };
      return next;
    });
  };

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((label, i) => {
        const tabPhase = i + 1;
        const isActive = tabPhase === phase;
        const canJump = tabPhase <= reached && !isActive;
        const count = counts[i] ?? 0;
        return (
          <Pressable
            key={label}
            onLayout={onLayout(i)}
            onPress={canJump ? () => onJump(tabPhase) : undefined}
            disabled={!canJump}
            hitSlop={HIT}
            accessibilityRole="tab"
            accessibilityLabel={count > 0 && i < 3 ? `${label}, ${count} picked` : label}
            accessibilityState={{ selected: isActive, disabled: !canJump && !isActive }}
            style={styles.tab}
          >
            <AppText
              variant="footnote"
              color={isActive ? "brand" : tabPhase <= reached ? "secondary" : "tertiary"}
            >
              {label}
            </AppText>
            {count > 0 && i < 3 ? (
              <View style={[styles.tabCount, { backgroundColor: alpha(colors.primary, isActive ? 0.22 : 0.12) }]}>
                <AppText variant="caption" color="brand">
                  {count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <View style={[styles.tabTrack, { backgroundColor: alpha(colors.border, 0.9) }]} />
      <Animated.View style={[styles.tabBar, { backgroundColor: colors.primary }, bar]} />
    </View>
  );
}

/* ─────────────────────────────── The choice ────────────────────────────── */

/** A large answer card: the flow's settle/lift language, with room for a preview. */
function PlanCard({
  selected,
  onPress,
  title,
  body,
  lead,
  children,
  delay,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  body: string;
  lead: React.ReactNode;
  children?: React.ReactNode;
  delay: number;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, { duration: motion.dur(Dur.tap), easing: Ease.soft });
  }, [selected, motion, sel]);

  const restFill = alpha(colors.surface, 0.72);
  const selFill = alpha(colors.primary, 0.09);
  const restLine = alpha(colors.border, 0.9);
  const selLine = alpha(colors.primary, 0.6);
  const lift = motion.dist(3);

  const frame = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restFill, selFill]),
    borderColor: interpolateColor(sel.value, [0, 1], [restLine, selLine]),
    transform: [{ translateY: -lift * sel.value }, { scale: 1 - 0.025 * press.value }],
  }));
  const dot = useAnimatedStyle(() => ({ opacity: sel.value, transform: [{ scale: 0.4 + 0.6 * sel.value }] }));

  return (
    <Appear delay={delay} duration={Dur.content} distance={Travel.card}>
      <Animated.View style={[styles.planCard, frame]}>
        <Pressable
          onPress={() => {
            selectHaptic();
            onPress();
          }}
          onPressIn={() => {
            press.value = withSpring(1, Spring.press);
          }}
          onPressOut={() => {
            press.value = withSpring(0, Spring.press);
          }}
          accessibilityRole="radio"
          accessibilityLabel={title}
          accessibilityHint={body}
          accessibilityState={{ selected, checked: selected }}
          style={styles.planPad}
        >
          <View style={styles.planHead}>
            {lead}
            <View style={styles.flex}>
              <AppText variant="headline" color={selected ? "brand" : "primary"}>
                {title}
              </AppText>
              <AppText variant="subhead" color="secondary">
                {body}
              </AppText>
            </View>
            <View style={[styles.radio, { borderColor: selected ? colors.primary : alpha(colors.textTertiary, 0.7) }]}>
              <Animated.View style={[styles.radioDot, { backgroundColor: colors.primary }, dot]} />
            </View>
          </View>
          {children}
        </Pressable>
      </Animated.View>
    </Appear>
  );
}

export interface MenuSample {
  /** "Today", "Tomorrow", "Wednesday". */
  label: string;
  /** Breakfast, lunch and dinner titles for that day. */
  meals: string[];
}

/** The coming days' real dishes, one day at a time — a peek, not a promise. */
function DishTicker({ samples }: { samples: MenuSample[] }) {
  const { colors } = useColors();
  const motion = useMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (samples.length < 2 || !motion.ambient) return;
    const t = setInterval(() => setI((n) => (n + 1) % samples.length), 2800);
    return () => clearInterval(t);
  }, [samples.length, motion.ambient]);

  const sample = samples[i % Math.max(1, samples.length)];
  if (!sample) return null;

  return (
    <View style={[styles.ticker, { backgroundColor: alpha(colors.surfaceSunken, 0.7), borderColor: alpha(colors.border, 0.8) }]}>
      <CrossFade contentKey={i}>
        <View style={styles.tickerBody} accessible accessibilityLabel={`${sample.label}: ${sample.meals.join(", ")}`}>
          <AppText variant="caption" color="brand" uppercase>
            {sample.label}
          </AppText>
          {sample.meals.map((meal, k) => (
            <View key={k} style={styles.tickerRow}>
              <OnboardingGlyph
                name={(["sunrise", "spark", "moon"] as GlyphName[])[k] ?? "plate"}
                tone={colors.textTertiary}
                size={15}
              />
              <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.flex}>
                {meal}
              </AppText>
            </View>
          ))}
        </View>
      </CrossFade>
    </View>
  );
}

function ModeChoice({
  mode,
  onMode,
  cuisine,
  dailyKcal,
  samples,
  dietName,
  oneDay,
}: {
  mode: MenuMode;
  onMode: (m: MenuMode) => void;
  cuisine: string | null;
  dailyKcal: number;
  samples: MenuSample[];
  dietName?: string | null;
  oneDay?: boolean;
}) {
  const { colors } = useColors();
  const kcal = dailyKcal.toLocaleString("en-US");
  const kitchen = cuisine ? `${cuisine} ` : "";
  // Starting a diet from the Diet screen: the dishes are that diet's, so say so.
  const support = dietName
    ? `Every dish stays within the ${dietName}${cuisine ? ` and your ${cuisine} kitchen` : ""}, portioned to your ${kcal} kcal.`
    : cuisine
      ? `Every dish comes from ${cuisine} cooking, portioned to your ${kcal} kcal.`
      : `Every dish is portioned to your ${kcal} kcal.`;
  const autoBody = dietName
    ? oneDay
      ? `Gozlin builds today from the ${dietName}’s ${kitchen}dishes.`
      : `Gozlin builds each day from the ${dietName}’s ${kitchen}dishes — never the same plate two days running.`
    : `Gozlin builds each day from ${kitchen}dishes and keeps them varied.`;
  const chooseBody = dietName
    ? oneDay
      ? "Pick today’s breakfast, lunch and dinner from this diet. I’ll size the portions and fill any gaps."
      : "Pick your own breakfasts, lunches and dinners from this diet. I’ll size the portions and fill any gaps."
    : "Pick your own breakfasts, lunches and dinners. I’ll size the portions and fill any gaps.";
  return (
    <View style={styles.chapter}>
      <View style={styles.question}>
        <AnimatedText variant="question" duration={Dur.content}>
          How should we plan your meals?
        </AnimatedText>
        <AnimatedText variant="support" color="secondary" delay={120} duration={Dur.content}>
          {support}
        </AnimatedText>
      </View>

      <View style={styles.rail}>
        <PlanCard
          selected={mode === "auto"}
          onPress={() => onMode("auto")}
          title="Plan them for me"
          body={autoBody}
          lead={<AILogoBadge size={34} />}
          delay={OPTIONS_DELAY}
        >
          <DishTicker samples={samples} />
        </PlanCard>

        <PlanCard
          selected={mode === "choose"}
          onPress={() => onMode("choose")}
          title="Let me choose"
          body={chooseBody}
          lead={
            <View style={[styles.leadDisc, { borderColor: alpha(colors.primary, 0.45) }]}>
              <OnboardingGlyph name="plate" tone={colors.primary} size={20} />
            </View>
          }
          delay={OPTIONS_DELAY + Stagger.item * 2}
        >
          <View style={styles.slotPreview}>
            {(["sunrise", "spark", "moon"] as GlyphName[]).map((g, k) => (
              <View key={g} style={styles.slotChip}>
                <OnboardingGlyph name={g} tone={colors.textTertiary} size={15} />
                <AppText variant="caption" color="tertiary">
                  {["Breakfast", "Lunch", "Dinner"][k]}
                </AppText>
              </View>
            ))}
          </View>
        </PlanCard>
      </View>
    </View>
  );
}

/* ─────────────────────────────── A dish row ────────────────────────────── */

function DishRow({
  dish,
  selected,
  tone,
  meta,
  days,
  onPress,
  capped,
  when,
}: {
  dish: Dish;
  selected: boolean;
  tone: string;
  meta: string;
  days: number[];
  onPress: () => void;
  capped: boolean;
  /** Overrides the weekday line — "Today" on a one-day plan. */
  when?: string;
}) {
  const dayText = when ?? daysLine(days);
  const { colors } = useColors();
  const motion = useMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, { duration: motion.dur(Dur.tap), easing: Ease.soft });
  }, [selected, motion, sel]);

  const restFill = alpha(colors.surface, 0.6);
  const selFill = alpha(tone, 0.08);
  const restLine = alpha(colors.border, 0.8);
  const selLine = alpha(tone, 0.55);
  const restDisc = alpha(colors.surfaceSunken, 0.9);
  const selDisc = alpha(tone, 0.2);

  const frame = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restFill, selFill]),
    borderColor: interpolateColor(sel.value, [0, 1], [restLine, selLine]),
    transform: [{ scale: 1 - 0.02 * press.value }],
  }));
  const disc = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [restDisc, selDisc]),
    transform: [{ scale: 1 + 0.06 * sel.value }],
  }));
  const check = useAnimatedStyle(() => ({ opacity: sel.value, transform: [{ scale: 0.6 + 0.4 * sel.value }] }));

  const dim = capped && !selected;

  return (
    <Animated.View style={[styles.dish, frame, dim && styles.dimmed]}>
      <Pressable
        onPress={() => {
          selectHaptic();
          onPress();
        }}
        onPressIn={() => {
          press.value = withSpring(1, Spring.press);
        }}
        onPressOut={() => {
          press.value = withSpring(0, Spring.press);
        }}
        accessibilityRole="checkbox"
        accessibilityLabel={`${dish.title}. ${meta}.${selected ? ` ${dayText}.` : ""}`}
        accessibilityState={{ checked: selected, selected }}
        style={styles.dishPad}
      >
        <Animated.View style={[styles.dishDisc, disc]}>
          <AppText variant="caption" color={selected ? tone : "tertiary"} style={styles.mono}>
            {monogram(dish.title)}
          </AppText>
        </Animated.View>
        <View style={styles.flex}>
          <AppText variant="callout" color={selected ? "primary" : "secondary"} numberOfLines={2}>
            {dish.title}
          </AppText>
          <AppText variant="footnote" color="tertiary">
            {meta}
          </AppText>
          {selected ? (
            <Appear key={dayText} delay={0} duration={Dur.ui} distance={4}>
              <AppText variant="footnote" color={tone} style={styles.daysLine}>
                {dayText}
              </AppText>
            </Appear>
          ) : null}
        </View>
        <Animated.View style={[styles.check, { backgroundColor: tone }, check]} pointerEvents="none">
          <View style={[styles.checkMark, { borderColor: colors.onPrimary }]} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────────────────── A meal chapter ──────────────────────────── */

/** Staple words worth a quick cut, in the order they are offered. */
const CUT_WORDS = [
  "rice", "beans", "yam", "plantain", "pap", "akara", "moi-moi", "soup", "swallow", "stew",
  "porridge", "egg", "fish", "chicken", "salad", "oats", "toast", "yogurt", "pasta",
  "potato", "wrap", "bowl", "lentil", "chickpea", "tofu", "quinoa", "omelette",
  // The Asian kitchen's own staples.
  "curry", "noodle", "dal", "roti", "congee",
];

function cutsFor(dishes: Dish[]): string[] {
  if (dishes.length < 12) return [];
  return CUT_WORDS.map((w) => ({
    w,
    n: dishes.filter((d) => d.title.toLowerCase().includes(w)).length,
  }))
    .filter((c) => c.n >= 3 && c.n < dishes.length)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((c) => c.w);
}

const capital = (w: string) => w.replace(/(^|-)([a-z])/g, (_, p, c) => p + c.toUpperCase());

/**
 * Dishes mounted at a time. Every row is an animated card, and a cuisine can
 * offer 180 of them: mounted at once they froze a 1 GB phone for seconds on
 * "Start with breakfast". A page is a screenful and a bit; the rest are one tap
 * away, and search and the quick cuts still reach every dish.
 */
const PAGE = 12;

/** The first `n` of a list, plus any pick further down — a pick never hides. */
function paged(list: Dish[], n: number, picked: Record<string, Dish>): Dish[] {
  return list.filter((d, i) => i < n || !!picked[d.key]);
}

/** The next page of a long list. Nothing when the list is all out. */
function MoreRow({ hidden, onPress }: { hidden: number; onPress: () => void }) {
  const { colors } = useColors();
  if (hidden <= 0) return null;
  const label = hidden > PAGE ? `Show ${PAGE} more (${hidden} left)` : `Show the last ${hidden}`;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.moreRow, { borderColor: alpha(colors.border, 0.9) }]}
    >
      <AppText variant="footnote" color="secondary">
        {label}
      </AppText>
    </Pressable>
  );
}

function SlotChapter({
  slot,
  dishes,
  staples,
  draft,
  onToggleDish,
  onCycleDay,
  metaFor,
  maxPicks,
  active = ALL_DAYS,
  planLength = 7,
}: {
  slot: MainSlot;
  dishes: Dish[];
  staples: Dish[];
  draft: MenuDraft;
  onToggleDish: (dish: Dish) => void;
  onCycleDay: (slot: MainSlot, day: number) => void;
  metaFor: (dish: Dish) => string;
  maxPicks: number;
  /** The weekdays the plan reaches, Monday = 0. Every day, unless it is shorter than a week. */
  active?: readonly number[];
  /** How many days the plan runs. */
  planLength?: number;
}) {
  const { colors } = useColors();
  const tones = pickTones(colors);
  const oneDay = planLength === 1;
  const copy = oneDay
    ? { ...SLOT_COPY[slot], ...ONE_DAY_COPY[slot] }
    : planLength < 7 && slot === "breakfast"
      ? {
          ...SLOT_COPY[slot],
          support: `Pick a few. I’ll rotate them through your ${planLength} days and size each one to your morning.`,
        }
      : SLOT_COPY[slot];
  const [cut, setCut] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showStaples, setShowStaples] = useState(dishes.length < 12);
  const [shown, setShown] = useState(PAGE);
  const [staplesShown, setStaplesShown] = useState(PAGE);
  // A new search or cut is a new list: it starts from its first page again.
  const refine = () => {
    setShown(PAGE);
    setStaplesShown(PAGE);
  };

  const picks = useMemo(
    () => Object.values(draft.dishes).filter((d) => d.slot === slot),
    [draft.dishes, slot],
  );
  const toneOf = (key: string) => {
    const at = picks.findIndex((p) => p.key === key);
    return tones[(at < 0 ? picks.length : at) % tones.length]!;
  };
  const week = draft.weeks[slot];
  const marks: WeekMark[] = week.map((key, day) => {
    if (!active.includes(day)) return { label: null, tone: null, spoken: "", inactive: true };
    const dish = key ? draft.dishes[key] : undefined;
    return dish
      ? { label: monogram(dish.title), tone: toneOf(dish.key), spoken: dish.title }
      : { label: null, tone: null, spoken: "Gozlin picks" };
  });

  const cuts = useMemo(() => cutsFor(dishes), [dishes]);
  const q = query.trim().toLowerCase();
  const visible = dishes.filter(
    (d) => (!cut || d.title.toLowerCase().includes(cut)) && (!q || d.title.toLowerCase().includes(q)),
  );
  const visibleStaples = staples.filter((d) => !q || d.title.toLowerCase().includes(q));
  const listed = paged(visible, shown, draft.dishes);
  const listedStaples = paged(visibleStaples, staplesShown, draft.dishes);
  // A one-dish meal is a radio: a new tap replaces the pick, so nothing is "full".
  const capped = maxPicks > 1 && picks.length >= maxPicks;
  const gozlinDays = active.filter((d) => week[d] === null).length;

  const row = (dish: Dish, i: number) => {
    const selected = !!draft.dishes[dish.key];
    // The first page waits for the question; a page asked for arrives at once.
    const lead = i < PAGE ? OPTIONS_DELAY + 160 : 0;
    return (
      <Appear
        key={dish.key}
        delay={lead + Math.min(i % PAGE, 8) * Stagger.item}
        duration={Dur.content}
        distance={Travel.rise}
      >
        <DishRow
          dish={dish}
          selected={selected}
          tone={toneOf(dish.key)}
          meta={metaFor(dish)}
          days={selected ? week.flatMap((k, d) => (k === dish.key ? [d] : [])) : []}
          capped={capped}
          onPress={() => onToggleDish(dish)}
          when={oneDay ? "Today" : undefined}
        />
      </Appear>
    );
  };

  return (
    <View style={styles.chapter}>
      <View style={styles.question}>
        <View style={styles.titleRow}>
          <OnboardingGlyph name={copy.glyph} tone={colors.primary} size={26} />
          <AnimatedText variant="question" duration={Dur.content} style={styles.flex}>
            {copy.title}
          </AnimatedText>
        </View>
        <AnimatedText variant="support" color="secondary" delay={120} duration={Dur.content}>
          {copy.support}
        </AnimatedText>
      </View>

      {/* The week — the one place days are assigned, drawn as the picture of them.
          A one-day plan has nothing to arrange, so it has no week. */}
      {oneDay ? null : (
        <Appear delay={OPTIONS_DELAY} duration={Dur.content} distance={8}>
          <View style={[styles.weekCard, { backgroundColor: alpha(colors.surface, 0.55), borderColor: alpha(colors.border, 0.9) }]}>
            <WeekStrip
              marks={marks}
              onPressDay={picks.length > 0 ? (day) => onCycleDay(slot, day) : undefined}
              delay={OPTIONS_DELAY + 80}
            />
            <AppText variant="footnote" color="tertiary" align="center" accessibilityLiveRegion="polite">
              {picks.length === 0
                ? `Nothing picked — Gozlin will choose every ${slot}.`
                : gozlinDays > 0
                  ? `Gozlin fills ${gozlinDays === 1 ? "one day" : `${gozlinDays} days`}. Tap a day to change it.`
                  : "Tap a day to swap what’s on it."}
            </AppText>
          </View>
        </Appear>
      )}

      {dishes.length >= 12 ? (
        <Appear delay={OPTIONS_DELAY + 100} duration={Dur.ui} distance={6}>
          <View style={[styles.search, { backgroundColor: alpha(colors.surfaceSunken, 0.85), borderColor: alpha(colors.border, 0.9) }]}>
            <OnboardingGlyph name="search" tone={colors.textTertiary} size={17} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                refine();
              }}
              placeholder={`Search ${dishes.length} ${copy.noun}`}
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={`Search ${copy.noun}`}
            />
          </View>
        </Appear>
      ) : null}

      {cuts.length > 0 ? (
        <Appear delay={OPTIONS_DELAY + 130} duration={Dur.ui} distance={6}>
          <View style={styles.cuts}>
            {[null, ...cuts].map((c) => {
              const on = cut === c;
              return (
                <Pressable
                  key={c ?? "all"}
                  onPress={() => {
                    setCut(c);
                    refine();
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={c ? `Show ${c} dishes` : "Show all dishes"}
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.cut,
                    {
                      backgroundColor: on ? alpha(colors.primary, 0.16) : alpha(colors.surface, 0.6),
                      borderColor: on ? alpha(colors.primary, 0.55) : alpha(colors.border, 0.9),
                    },
                  ]}
                >
                  <AppText variant="footnote" color={on ? "brand" : "secondary"}>
                    {c ? capital(c) : "All"}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Appear>
      ) : null}

      {capped ? (
        <AppText variant="footnote" color="tertiary" accessibilityLiveRegion="polite">
          {planLength < 7
            ? `${maxPicks} is plenty for ${planLength} days — remove one to add another.`
            : `${maxPicks} is plenty to rotate through a week — remove one to add another.`}
        </AppText>
      ) : null}

      <View style={styles.list}>
        {listed.map(row)}
        <MoreRow hidden={visible.length - listed.length} onPress={() => setShown((n) => n + PAGE)} />
        {visible.length === 0 ? (
          <AppText variant="subhead" color="tertiary" align="center" style={styles.empty}>
            Nothing matches that. Try another word.
          </AppText>
        ) : null}
      </View>

      {staples.length > 0 ? (
        showStaples ? (
          <View style={styles.list}>
            <View style={styles.sectionHead}>
              <AppText variant="caption" color="tertiary" uppercase>
                Everyday staples
              </AppText>
              <AppText variant="footnote" color="tertiary">
                Simple options that travel anywhere.
              </AppText>
            </View>
            {listedStaples.map((d, i) => row(d, i + listed.length))}
            <MoreRow
              hidden={visibleStaples.length - listedStaples.length}
              onPress={() => setStaplesShown((n) => n + PAGE)}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setShowStaples(true)}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel={`Also show ${staples.length} everyday staples`}
            style={[styles.moreRow, { borderColor: alpha(colors.border, 0.9) }]}
          >
            <AppText variant="footnote" color="secondary">
              Also show {staples.length} everyday staples
            </AppText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

/* ───────────────────────────── How long + glance ───────────────────────── */

function LengthChapter({
  lengths,
  length,
  onLength,
  draft,
  width,
  cuisine,
}: {
  lengths: readonly MenuLength[];
  length: number;
  onLength: (days: number) => void;
  draft: MenuDraft;
  width: number;
  cuisine: string | null;
}) {
  const { colors } = useColors();
  const tones = pickTones(colors);
  const options: GridOption<string>[] = lengths.map((l) => ({
    value: String(l.days),
    label: l.label,
    subtitle: `${l.days} days`,
    glyph: "calendar",
  }));

  const slots: { slot: MainSlot; label: string; glyph: GlyphName }[] = [
    { slot: "breakfast", label: "Breakfast", glyph: "sunrise" },
    { slot: "lunch", label: "Lunch", glyph: "spark" },
    { slot: "dinner", label: "Dinner", glyph: "moon" },
  ];
  const picked = slots.reduce((n, s) => n + draft.weeks[s.slot].filter((k) => k !== null).length, 0);
  const open = 21 - picked;

  return (
    <View style={styles.chapter}>
      <View style={styles.question}>
        <AnimatedText variant="question" duration={Dur.content}>
          How long should this menu run?
        </AnimatedText>
        <AnimatedText variant="support" color="secondary" delay={120} duration={Dur.content}>
          Your week repeats for as long as you choose. Every day stays editable in your planner.
        </AnimatedText>
      </View>

      <MultiSelectGrid
        options={options}
        selected={[String(length)]}
        onToggle={(v) => onLength(Number(v))}
        width={width}
        columns={2}
        role="radio"
        recedeUnselected
        delay={OPTIONS_DELAY}
      />

      <Appear delay={OPTIONS_DELAY + 320} duration={Dur.content} distance={Travel.card}>
        <View style={[styles.glance, { backgroundColor: alpha(colors.surface, 0.6), borderColor: alpha(colors.border, 0.9) }]}>
          <AppText variant="caption" color="tertiary" uppercase>
            Your week at a glance
          </AppText>
          {slots.map((s, r) => {
            const picks = Object.values(draft.dishes).filter((d) => d.slot === s.slot);
            const marks: WeekMark[] = draft.weeks[s.slot].map((key) => {
              const dish = key ? draft.dishes[key] : undefined;
              const at = dish ? picks.findIndex((p) => p.key === dish.key) : -1;
              return dish
                ? { label: monogram(dish.title), tone: tones[at % tones.length]!, spoken: dish.title }
                : { label: null, tone: null, spoken: "Gozlin picks" };
            });
            // Label ABOVE its week, not beside it: a label column costs the seven
            // marks the width they need on a 320pt screen.
            return (
              <View key={s.slot} style={styles.glanceRow}>
                <View style={styles.glanceLabel}>
                  <OnboardingGlyph name={s.glyph} tone={colors.textTertiary} size={15} />
                  <AppText variant="caption" color="tertiary" uppercase>
                    {s.label}
                  </AppText>
                </View>
                <WeekStrip
                  marks={marks}
                  size={28}
                  showLetters={r === 0}
                  delay={OPTIONS_DELAY + 420 + r * 140}
                />
              </View>
            );
          })}
          <AppText variant="footnote" color="secondary" style={styles.glanceNote}>
            {picked === 0
              ? `Gozlin will plan all 21 meals${cuisine ? ` from ${cuisine} dishes` : ""}, plus your snacks.`
              : open === 0
                ? "Every meal of the week is yours. Gozlin adds only your snacks."
                : `You picked ${picked} of 21 meals. Gozlin fills the other ${open}${cuisine ? ` with ${cuisine} dishes` : ""} — and your snacks.`}
          </AppText>
        </View>
      </Appear>
    </View>
  );
}

/* ──────────────────────────────── The step ─────────────────────────────── */

export interface MenuPlannerProps {
  /** 0 the choice · 1–3 breakfast, lunch, dinner · 4 how long. Owned by the step. */
  phase: number;
  onJump: (phase: number) => void;
  mode: MenuMode;
  onMode: (mode: MenuMode) => void;
  /** "African" — or null for "a bit of everything". */
  cuisine: string | null;
  dailyKcal: number;
  samples: MenuSample[];
  slots: Record<MainSlot, { dishes: Dish[]; staples: Dish[] }>;
  draft: MenuDraft;
  onToggleDish: (dish: Dish) => void;
  onCycleDay: (slot: MainSlot, day: number) => void;
  /** The line under each dish: the portion it would actually be served at. */
  metaFor: (dish: Dish) => string;
  maxPicks: number;
  /**
   * Whether the planner asks "how long?" as its last beat. Onboarding does; the
   * Diet screen has already asked by the time it opens the planner.
   */
  showLength?: boolean;
  lengths?: readonly MenuLength[];
  length?: number;
  onLength?: (days: number) => void;
  width?: number;
  /** The diet the dishes come from, when one was chosen first (the Diet screen). */
  dietName?: string | null;
  /** The weekdays the plan reaches, Monday = 0 — all seven unless it is shorter than a week. */
  active?: readonly number[];
  /** How many days the plan runs, when known up front. */
  planLength?: number;
  style?: StyleProp<ViewStyle>;
}

export function MenuPlanner({
  phase,
  onJump,
  mode,
  onMode,
  cuisine,
  dailyKcal,
  samples,
  slots,
  draft,
  onToggleDish,
  onCycleDay,
  metaFor,
  maxPicks,
  showLength = true,
  lengths,
  length,
  onLength,
  width,
  dietName,
  active = ALL_DAYS,
  planLength = 7,
  style,
}: MenuPlannerProps) {
  // The furthest beat visited — tabs up to it can be jumped back to.
  const [reached, setReached] = useState(phase);
  useEffect(() => setReached((r) => Math.max(r, phase)), [phase]);

  const counts = (["breakfast", "lunch", "dinner"] as MainSlot[]).map(
    (s) => Object.values(draft.dishes).filter((d) => d.slot === s).length,
  );
  const asksLength = showLength && !!lengths && length !== undefined && !!onLength;

  const body = () => {
    if (phase === 0) {
      return (
        <ModeChoice
          mode={mode}
          onMode={onMode}
          cuisine={cuisine}
          dailyKcal={dailyKcal}
          samples={samples}
          dietName={dietName}
          oneDay={planLength === 1}
        />
      );
    }
    if (phase === 4 && asksLength) {
      return (
        <LengthChapter
          lengths={lengths!}
          length={length!}
          onLength={onLength!}
          draft={draft}
          width={width ?? 0}
          cuisine={cuisine}
        />
      );
    }
    const slot = SLOT_OF_PHASE[phase] ?? "dinner";
    return (
      <SlotChapter
        key={slot}
        slot={slot}
        dishes={slots[slot].dishes}
        staples={slots[slot].staples}
        draft={draft}
        onToggleDish={onToggleDish}
        onCycleDay={onCycleDay}
        metaFor={metaFor}
        maxPicks={maxPicks}
        active={active}
        planLength={planLength}
      />
    );
  };

  return (
    <View style={[styles.wrap, style]}>
      {phase > 0 ? (
        <Appear duration={Dur.ui} distance={6}>
          <MenuTabs
            phase={phase}
            reached={reached}
            counts={counts}
            onJump={onJump}
            tabs={asksLength ? TABS : MEAL_TABS}
          />
        </Appear>
      ) : null}
      <CrossFade contentKey={phase} style={styles.stage}>
        {body()}
      </CrossFade>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: Spacing.xl },
  stage: { alignSelf: "stretch" },
  chapter: { gap: Rhythm.layer },
  question: { gap: Spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  rail: { gap: Spacing.md },

  tabs: { flexDirection: "row", gap: Spacing.lg, paddingBottom: Spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
  tabBar: { position: "absolute", left: 0, bottom: 0, height: 2, borderRadius: 1 },

  planCard: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
  planPad: { padding: Spacing.lg, gap: Spacing.lg, minHeight: MIN_TOUCH },
  planHead: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  leadDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  ticker: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, minHeight: 104 },
  tickerBody: { gap: 6 },
  tickerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },

  slotPreview: { flexDirection: "row", gap: Spacing.sm },
  slotChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
  },

  weekCard: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: MIN_TOUCH,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.sm },

  cuts: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  cut: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  list: { gap: Spacing.sm },
  empty: { paddingVertical: Spacing.xl },
  sectionHead: { gap: 2, marginTop: Spacing.sm },
  moreRow: {
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  dish: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  dimmed: { opacity: 0.5 },
  dishPad: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, minHeight: MIN_TOUCH + 12 },
  dishDisc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  mono: { letterSpacing: 0.6 },
  daysLine: { marginTop: 2 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    width: 9,
    height: 5,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    transform: [{ rotate: "-45deg" }],
    marginTop: -2,
  },

  glance: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  glanceRow: { gap: Spacing.sm },
  glanceLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  glanceNote: { marginTop: Spacing.xs },
});
