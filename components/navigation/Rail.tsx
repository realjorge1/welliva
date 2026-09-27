/**
 * THE RAIL — four destinations and one action, at three altitudes.
 *
 *   A · AT REST      [ ⌂ Home   Diet   Fitness   Gozlin ]  ( + )
 *   B · FOLDED       [ ⌂    ▤    ⬛    ✦ ]                  ( + )
 *   C · FOLDED + CUE [ ⌂ ] [ ▸ Log lunch          12:40 ]  ( + )
 *
 * On the compact destinations (`COMPACT_RAIL_PATHS` — Habits, Logs, Upgrade,
 * Settings, Profile) the Deck holds the rail at C whatever the scroll, so the
 * tabs never show there. The Rail itself does not know: it is handed
 * `folded` and a cue that is never null.
 *
 * THE RULE THAT MAKES IT NOT A SECOND NAVIGATION SYSTEM. Every tab here is an
 * entry from `RAIL_ITEMS`, which is `PRIMARY_ITEMS` filtered — the same data the
 * swipe menu renders, lit with the same gold, reading the same pathname. The
 * drawer is the map (eleven destinations); the rail is the fast lane to four of
 * them. A person who learns either one has learned the other.
 *
 * IT IS OPAQUE, AND THAT IS A DECISION. The first build floated the tabs on a
 * BlurView over a 5%-white fill, which on an OLED-black canvas is very nearly
 * nothing: the bar read as a hairline outline with content sliding through it.
 * Glass is right for the dock — a card that arrives over your content and
 * leaves again — and wrong for furniture that is always there and has to be
 * findable without being looked for. So the rail is a real surface, with a real
 * edge and a real shadow, and no blur at all (which also drops a compositing
 * layer that was buying nothing on Android, where BlurView degrades anyway).
 *
 * THE TRANSITIONS ARE A CROSSFADE, NOT A REMOUNT. Both layouts are mounted and
 * stacked; two shared values move everything:
 *
 *   · `fold`  0→1  pill height, the labels' own height and opacity, and the
 *                  action's size. A↔B never swaps components at all, so the
 *                  glyphs stay put and only the labels leave.
 *   · `swap`  0→1  crossfades the tab pill against the cue row for C.
 *
 * The earlier version keyed a single child on the mode, which unmounted one
 * layout and faded in the next — a visible cut on every fold. Stacking costs
 * one extra absolutely-positioned layer and buys a transition that actually
 * reads as one object changing shape.
 *
 * THE GOLD ACTION NEVER MOVES. Same corner, same shape, on every screen — it is
 * the one place muscle memory is allowed to live, and the reason the rest of
 * the Deck is free to change its mind. It shrinks with the fold and does
 * nothing else.
 */

import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Motion, Radius, Spacing } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { DECK_GAP, RAIL_CONDENSED, RAIL_HEIGHT } from "./DeckContext";
import { RAIL_ITEMS, type MenuItem } from "./menu";
import type { NextMove } from "./nextMove";

/**
 * The gold action at rest and folded.
 *
 * IT IS SMALLER THAN THE RAIL IS TALL. It used to be a perfect 62pt circle
 * matching the pill's height, which looked balanced in isolation and starved
 * the tabs: four labels sharing what was left put "Fitness" and "Gozlin" hard
 * against their edges. Eight points off the button is eight points onto every
 * label, and 54 is still well over the 44pt touch floor.
 */
const ACTION = 54;
const ACTION_FOLDED = 48;
/** The glyph box. Fixed, so the labels leaving cannot move the icons. */
const GLYPH = 30;
/** The label's own line box, collapsed to nothing by the fold. */
const LABEL_H = 13;
const LABEL_GAP = 4;

const TIMING = {
  duration: Motion.duration.base,
  easing: Easing.bezier(...(Motion.easing.standard as [number, number, number, number])),
} as const;

export interface RailProps {
  /** Scrolled away from the top: labels drop and the row narrows. */
  folded: boolean;
  /**
   * The cue, when the rail is folded and should carry it instead of the dock.
   * This is the whole trick of the folded state: the space three labels gave
   * up is exactly the space one prompt needs.
   */
  inlineCue: NextMove | null;
  /** Run the inline cue's action. */
  onCue: () => void;
  /** Open the quick-log sheet. */
  onAction: () => void;
  /** Write the most-repeated log without opening anything. */
  onActionHold: () => void;
}

/* ──────────────────────────────── one tab ─────────────────────────────── */

function Tab({
  item,
  active,
  fold,
  onPress,
}: {
  item: MenuItem;
  active: boolean;
  /** 0 = labelled, 1 = glyph only. Shared, so every label leaves together. */
  fold: SharedValue<number>;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const tint = active ? colors.primary : colors.textTertiary;

  // Height AND opacity, not opacity alone: a label that keeps its box while
  // invisible leaves the glyphs sitting high in a shorter bar.
  const labelStyle = useAnimatedStyle(() => ({
    height: interpolate(fold.value, [0, 1], [LABEL_H, 0]),
    paddingTop: interpolate(fold.value, [0, 1], [LABEL_GAP, 0]),
    opacity: 1 - fold.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      hitSlop={6}
    >
      <View style={styles.glyph}>
        {item.mark === "gozlin" ? (
          // Gozlin keeps its own mark and does NOT keep its own colour:
          // monochrome, tinted exactly like every other glyph, so the rail
          // holds its one rule — gold means "you are here".
          <AILogoIcon size={21} color={tint} />
        ) : (
          <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={tint} />
        )}
      </View>
      <Animated.View style={[styles.labelBox, labelStyle]}>
        <AppText
          variant="caption"
          weight={active ? "700" : "600"}
          numberOfLines={1}
          style={[styles.label, { color: tint }]}
        >
          {item.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/* ─────────────────────────────── the rail ─────────────────────────────── */

export function Rail({ folded, inlineCue, onCue, onAction, onActionHold }: RailProps) {
  const { colors, isDark } = useColors();
  const pathname = usePathname();
  const router = useRouter();

  const go = useCallback(
    (item: MenuItem) => {
      if (item.href === pathname) return;
      Haptics.selectionAsync().catch(() => {});
      // Land on the root screen, never underneath a pushed detail view — the
      // same contract the drawer's own navigation keeps, so arriving by rail
      // and arriving by menu leave the stack in identical shape.
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // canDismiss throws when there is no stack to ask; nothing to dismiss.
      }
      router.navigate(item.href as never);
    },
    [pathname, router],
  );

  const activeItem = RAIL_ITEMS.find((i) => i.href === pathname) ?? RAIL_ITEMS[0];
  const showCue = folded && inlineCue != null;

  /**
   * The cue that is on screen, which is not always the one that is current.
   * Held one beat longer so the layer has something to draw while it fades OUT
   * — without this the text vanishes on the first frame and the crossfade is a
   * fade from blank.
   */
  const [shownCue, setShownCue] = useState<NextMove | null>(inlineCue);
  useEffect(() => {
    if (inlineCue) setShownCue(inlineCue);
  }, [inlineCue]);

  const fold = useSharedValue(folded ? 1 : 0);
  const swap = useSharedValue(showCue ? 1 : 0);
  useEffect(() => {
    fold.value = withTiming(folded ? 1 : 0, TIMING);
  }, [folded, fold]);
  useEffect(() => {
    swap.value = withTiming(showCue ? 1 : 0, TIMING);
  }, [showCue, swap]);

  const slotStyle = useAnimatedStyle(() => ({
    height: interpolate(fold.value, [0, 1], [RAIL_HEIGHT, RAIL_CONDENSED]),
  }));
  const tabsStyle = useAnimatedStyle(() => ({ opacity: 1 - swap.value }));
  const cueStyle = useAnimatedStyle(() => ({ opacity: swap.value }));
  const actionStyle = useAnimatedStyle(() => {
    const size = interpolate(fold.value, [0, 1], [ACTION, ACTION_FOLDED]);
    return { width: size, height: size, borderRadius: size / 2 };
  });

  // A real surface, not a tint over a blur — see the header.
  const surface = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  };
  const lift = {
    shadowColor: colors.shadowColor,
    shadowOpacity: isDark ? 0.5 : 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  };

  return (
    <View style={styles.row} pointerEvents="box-none">
      <Animated.View style={[styles.slot, slotStyle]}>
        {/* A + B — one pill, never remounted. The labels leave; the glyphs
            stay exactly where they are. */}
        <Animated.View
          style={[styles.layer, tabsStyle]}
          pointerEvents={showCue ? "none" : "auto"}
          // Opacity 0 hides a layer from the EYE, not from a screen reader:
          // without this, VoiceOver finds four phantom tabs stacked under a
          // cue, or a phantom cue under the tabs. Same pair the drawer uses to
          // put the app to sleep behind the open menu.
          accessibilityElementsHidden={showCue}
          importantForAccessibility={showCue ? "no-hide-descendants" : "auto"}
        >
          <View style={[styles.pill, surface, lift]}>
            {RAIL_ITEMS.map((item) => (
              <Tab
                key={item.route}
                item={item}
                active={item.href === pathname}
                fold={fold}
                onPress={() => go(item)}
              />
            ))}
          </View>
        </Animated.View>

        {/* C — the active glyph, the prompt, and nothing else. The shape of
            the folded rail is the shape of a single sentence. */}
        <Animated.View
          style={[styles.layer, styles.cueRow, cueStyle]}
          pointerEvents={showCue ? "auto" : "none"}
          accessibilityElementsHidden={!showCue}
          importantForAccessibility={showCue ? "auto" : "no-hide-descendants"}
        >
          {/* Gold only when this REALLY is where you are. On Habits or Logs —
              menu destinations with no rail slot — the anchor falls back to
              Home and must not claim to be the current screen: one lit glyph
              that lies is worse than none. */}
          <Pressable
            onPress={() => go(activeItem)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeItem.href === pathname }}
            accessibilityLabel={activeItem.label}
            style={({ pressed }) => [
              styles.anchor,
              surface,
              lift,
              pressed && styles.pressed,
            ]}
          >
            {activeItem.mark === "gozlin" ? (
              <AILogoIcon
                size={21}
                color={
                  activeItem.href === pathname ? colors.primary : colors.textTertiary
                }
              />
            ) : (
              <Ionicons
                name={
                  activeItem.href === pathname ? activeItem.activeIcon : activeItem.icon
                }
                size={21}
                color={
                  activeItem.href === pathname ? colors.primary : colors.textTertiary
                }
              />
            )}
          </Pressable>

          <Pressable
            onPress={onCue}
            accessibilityRole="button"
            accessibilityLabel={
              shownCue?.caption
                ? `${shownCue.label}. ${shownCue.caption}`
                : shownCue?.label
            }
            style={({ pressed }) => [
              styles.cuePill,
              surface,
              lift,
              pressed && styles.pressed,
            ]}
          >
            {shownCue?.voice === "gozlin" ? (
              <AILogoIcon size={17} color={colors.primary} />
            ) : (
              <Ionicons
                name={shownCue?.icon ?? "ellipse-outline"}
                size={17}
                color={colors.primary}
              />
            )}
            {/* BOTH HALVES SHRINK, AND THAT IS THE WHOLE FIX. React Native
                defaults `flexShrink` to 0, unlike the web — so a caption like
                "Grilled chicken with roasted vegetables" held its full natural
                width, shoved the label out of the pill and ran off the end of
                the bar. Each half now shrinks and truncates on its own, and the
                caption is capped so a long meal name can never squeeze the
                verb down to an ellipsis. */}
            <AppText
              variant="callout"
              weight="700"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.cueLabel}
            >
              {shownCue?.label}
            </AppText>
            {shownCue?.caption ? (
              <AppText
                variant="footnote"
                color="tertiary"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.cueCaption}
              >
                {shownCue.caption}
              </AppText>
            ) : null}
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* No shadow on the gold: it is the highest-contrast thing on the
          screen and does not need lifting, and a shadow here would need its
          own opaque wrapper anyway — iOS clips a shadow to whatever view
          carries `overflow: hidden`, which the gradient fill requires. */}
      <Animated.View style={actionStyle}>
        <Pressable
          onPress={onAction}
          onLongPress={onActionHold}
          delayLongPress={320}
          accessibilityRole="button"
          accessibilityLabel="Quick log"
          accessibilityHint="Log a meal, water, a workout, a weigh-in or a check-in. Hold to log a glass of water."
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={colors.brandGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: DECK_GAP,
  },

  /** Holds both layouts stacked. Its height is the rail's height. */
  slot: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  cueRow: { flexDirection: "row", alignItems: "center", gap: DECK_GAP - 1 },
  anchor: {
    width: RAIL_CONDENSED,
    // Fixed, not "100%": this layer only ever shows while folded, and an
    // explicit height cannot argue with the row's `alignItems: center`.
    height: RAIL_CONDENSED,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cuePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: RAIL_CONDENSED,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** Grows into the space, shrinks out of it, truncates rather than escaping. */
  cueLabel: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  /** Capped: a long meal name must never squeeze the verb to an ellipsis. */
  cueCaption: { flexShrink: 1, minWidth: 0, maxWidth: "46%" },

  // Even quarters, so "Fitness" and "Gozlin" get exactly as much room as
  // "Home" — a `minWidth` per tab left the longer two crowding their edges.
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  glyph: {
    width: GLYPH,
    height: GLYPH,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBox: { overflow: "hidden", justifyContent: "flex-start" },
  label: { fontSize: 10, lineHeight: LABEL_H, letterSpacing: 0 },

  action: {
    width: "100%",
    height: "100%",
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  pressed: { opacity: 0.9 },
});
