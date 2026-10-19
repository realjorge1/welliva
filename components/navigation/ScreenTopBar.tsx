/**
 * SCREEN TOP BAR — the two-line header every root screen starts with.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ [☰]      Good morning       [swap]   [G]    │  line 1: menu · greeting · actions · coach
 *   │ Diet                    Your plan for today │  line 2: screen name · titleRight
 *   └─────────────────────────────────────────────┘
 *
 * It exists so the menu control lands in exactly the same place on all eleven
 * destinations: the affordance for "where am I and where else can I go" must not
 * move by a pixel between screens, or people stop trusting it's there. The
 * screen's own name sits directly beneath it, so identity and navigation share
 * one column and the rest of the row stays free.
 *
 * THE GREETING IS TRULY CENTRED ON THE SCREEN, not centred in the gap between
 * the menu button and whatever actions a screen happens to have. That's why it's
 * an absolutely-positioned layer rather than a flexed child — otherwise Fitness
 * (streak chip) and Home (nothing) would centre it in two different places, and
 * the eye reads that as a wobble between screens. The layer is
 * `pointerEvents="none"`, so it can span the full width without ever stealing a
 * tap from the controls it passes under.
 *
 * IT FOLDS INTO AN ISLAND (inside a FloatingHeader — see that file for why).
 * The page scrolls under the header instead of being cut off at its foot, so as
 * the page arrives:
 *
 *   ( [☰]  Diet                        [swap]  [G] )   line 1, on its plate
 *
 * - line 1 stays exactly where it is, and an opaque pill grows in behind it;
 * - line 2 fades and lifts away — the page is passing through it;
 * - the screen's name rises into line 1 beside the menu (`compactTitle`), and
 *   Home's greeting gives way to it.
 * Outside a FloatingHeader none of this exists and the bar is the plain header
 * it always was.
 *
 * SLOTS:
 *   · `greeting` — Home only. Every other screen leaves line 1 to the menu.
 *   · `title`    — the screen name, under the menu button. A string gets the
 *     house style (`title`, 22pt — matched to the greeting); pass a node when a
 *     screen needs a subtitle or its own treatment (Home's "welliva" wordmark).
 *   · `compactTitle` — the name the island shows. Defaults to `title` when that
 *     is a string; a screen whose title is a node names itself here.
 *   · `right`    — screen actions (Diet's plan swap, Fitness's streak chip).
 *     They're on line 1, so they ride the island.
 *   · `trailing` — the far right of the menu's own line, after everything else.
 *     The Gozlin button's home. It's a separate slot from `right` precisely so
 *     the coach is pinned to the same corner on every screen that has one, no
 *     matter what actions that screen adds beside it.
 *   · `titleRight` — the far end of the NAME's line, opposite the screen name.
 *     Optically centred against the name's own line height, so a one-line
 *     caption reads as a pair with the title instead of sagging beneath it.
 *     It folds away with line 2, so nothing that must stay reachable goes here.
 *   · `foldedRight` — what the island carries in its place: an action that
 *     lives on line 2 at rest but must survive the fold (Foods' barcode
 *     scanner). Invisible and untouchable until the header folds.
 *
 * This replaced the back arrows these screens used to have. They aren't pushed
 * any more — they're root screens the menu switches to — so a back arrow would
 * have pointed at whatever happened to be behind it, which is nothing.
 */

import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { RETRO_FONT } from "@/constants/RetroFont";
import { Radius, Spacing, Typography } from "@/constants/theme";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useHeaderFold } from "./FloatingHeader";
import { MenuButton } from "./MenuButton";

export interface ScreenTopBarProps {
  /** Centred on the menu button's line. Home only. */
  greeting?: string;
  /** The screen name, under the menu button. String → house style. */
  title?: React.ReactNode;
  /** The name the folded island shows. Defaults to a string `title`. */
  compactTitle?: string;
  /** Screen actions on the menu button's line. */
  right?: React.ReactNode;
  /** Pinned to the far right of the menu's line, after `right`. Gozlin's home. */
  trailing?: React.ReactNode;
  /** Far end of the screen-name line, opposite the name. */
  titleRight?: React.ReactNode;
  /** Joins the island once folded — a line-2 action that must stay reachable. */
  foldedRight?: React.ReactNode;
  /** Put a soft plate behind the hamburger (for image or gradient headers). */
  plated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Keeps a long greeting clear of the menu button and the actions it passes. */
const CENTRE_INSET = 52;

/**
 * How far the island reaches past line 1's own box. Enough that the menu glyph
 * and the coach's ring sit inside the pill rather than on its rim, little
 * enough that it still clears the screen edge by the same few points.
 */
const ISLAND_PAD_X = 6;
const ISLAND_PAD_Y = 4;

const clamp = Extrapolation.CLAMP;

export function ScreenTopBar({
  greeting,
  title,
  compactTitle,
  right,
  trailing,
  titleRight,
  foldedRight,
  plated,
  style,
}: ScreenTopBarProps) {
  const { colors } = useColors();
  const fold = useHeaderFold();
  const resting = useSharedValue(0);
  const p = fold?.progress ?? resting;

  // Who takes touches flips at half-way, on the JS side, because
  // `pointerEvents` is a render and the fold is not.
  const [folded, setFolded] = useState(false);
  useAnimatedReaction(
    () => p.value> 0.5,
    (now, before) => {
      if (now !== before) runOnJS(setFolded)(now);
    },
  );

  // The page reaches line 2 first, so line 2 is out of the way before the
  // island forms, and the name only arrives once the island is there to hold it.
  const nameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.55], [1, 0], clamp),
    transform: [{ translateY: interpolate(p.value, [0, 1], [0, -8], clamp) }],
  }));
  const islandStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1], clamp),
    transform: [{ scale: interpolate(p.value, [0.45, 1], [0.97, 1], clamp) }],
  }));
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.15, 0.6], [1, 0], clamp),
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.7, 1], [0, 1], clamp),
    transform: [{ translateY: interpolate(p.value, [0.7, 1], [6, 0], clamp) }],
  }));

  const compact = compactTitle ?? (typeof title === "string" ? title : undefined);

  return (
    <View style={style} pointerEvents="box-none">
      <View
        style={styles.topLine}
        pointerEvents="box-none"
        onLayout={
          fold
            ? (e) => fold.reportBar(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
            : undefined
        }
      >
        {/* First, so every control draws on top of it. Solid, hairline-edged
            and shadowless: it's a surface the page passes under, not a lift. */}
        {fold ? (
          <Animated.View
            pointerEvents={folded ? "auto" : "none"}
            style={[
              styles.island,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
              islandStyle,
            ]}
          />
        ) : null}

        <MenuButton plated={plated} />
        <View style={styles.flex} pointerEvents="none">
          {fold && compact ? (
            <Animated.View style={compactStyle}>
              <AppText variant="headline" numberOfLines={1}>
                {compact}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
        {fold && foldedRight ? (
          <Animated.View style={compactStyle} pointerEvents={folded ? "box-none" : "none"}>
            {foldedRight}
          </Animated.View>
        ) : null}
        {right}
        {trailing}

        {/* Drawn last so it layers over the row, but it takes no space and no
            touches — the controls above keep their exact positions. */}
        {greeting ? (
          <Animated.View
            style={[styles.centreLayer, greetingStyle]}
            pointerEvents="none"
          >
            <AppText
              variant="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              align="center"
              style={styles.fact}
            >
              {greeting}
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      {title != null || titleRight != null ? (
        <Animated.View
          style={[styles.nameLine, nameStyle]}
          pointerEvents={folded ? "none" : "box-none"}
        >
          <View style={styles.flex}>
            {typeof title === "string" ? (
              <AppText variant="title" numberOfLines={1}>
                {title}
              </AppText>
            ) : (
              title
            )}
          </View>
          {titleRight ? (
            <View style={styles.nameRight}>{titleRight}</View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { fontFamily: RETRO_FONT, fontWeight: "normal", fontSize: 13, lineHeight: 20, letterSpacing: 0.5 },
  flex: { flex: 1 },

  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 44,
  },
  island: {
    position: "absolute",
    top: -ISLAND_PAD_Y,
    bottom: -ISLAND_PAD_Y,
    left: -ISLAND_PAD_X,
    right: -ISLAND_PAD_X,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centreLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: CENTRE_INSET,
  },

  nameLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  // `minHeight` is the title's own line box, and `justifyContent: center` sits
  // the caption in the middle of it. Cheaper and far more predictable across
  // platforms than `alignItems: "baseline"` on a container whose left child may
  // be a multi-line block (a title plus its sync pill).
  nameRight: {
    flexShrink: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: Typography.title.lineHeight,
  },
});
