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
 * SLOTS:
 *   · `greeting` — Home only. Every other screen leaves line 1 to the menu.
 *   · `title`    — the screen name, under the menu button. A string gets the
 *     house style (`title`, 22pt — matched to the greeting); pass a node when a
 *     screen needs a subtitle or its own treatment (Home's "Welliva" wordmark).
 *   · `right`    — screen actions (Diet's plan swap, Fitness's streak chip).
 *   · `trailing` — the far right of the menu's own line, after everything else.
 *     The Gozlin button's home. It's a separate slot from `right` precisely so
 *     the coach is pinned to the same corner on every screen that has one, no
 *     matter what actions that screen adds beside it.
 *   · `titleRight` — the far end of the NAME's line, opposite the screen name.
 *     Optically centred against the name's own line height, so a one-line
 *     caption reads as a pair with the title instead of sagging beneath it.
 *
 * This replaced the back arrows these screens used to have. They aren't pushed
 * any more — they're root screens the menu switches to — so a back arrow would
 * have pointed at whatever happened to be behind it, which is nothing.
 */

import { AppText } from "@/components/ui/Text";
import { Spacing, Typography } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { MenuButton } from "./MenuButton";

export interface ScreenTopBarProps {
  /** Centred on the menu button's line. Home only. */
  greeting?: string;
  /** The screen name, under the menu button. String → house style. */
  title?: React.ReactNode;
  /** Screen actions on the menu button's line. */
  right?: React.ReactNode;
  /** Pinned to the far right of the menu's line, after `right`. Gozlin's home. */
  trailing?: React.ReactNode;
  /** Far end of the screen-name line, opposite the name. */
  titleRight?: React.ReactNode;
  /** Put a soft plate behind the hamburger (for image or gradient headers). */
  plated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Keeps a long greeting clear of the menu button and the actions it passes. */
const CENTRE_INSET = 52;

export function ScreenTopBar({
  greeting,
  title,
  right,
  trailing,
  titleRight,
  plated,
  style,
}: ScreenTopBarProps) {
  return (
    <View style={style}>
      <View style={styles.topLine}>
        <MenuButton plated={plated} />
        <View style={styles.flex} />
        {right}
        {trailing}

        {/* Drawn last so it layers over the row, but it takes no space and no
            touches — the controls above keep their exact positions. */}
        {greeting ? (
          <View style={styles.centreLayer} pointerEvents="none">
            <AppText variant="title" numberOfLines={1} align="center">
              {greeting}
            </AppText>
          </View>
        ) : null}
      </View>

      {title != null || titleRight != null ? (
        <View style={styles.nameLine}>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 44,
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
