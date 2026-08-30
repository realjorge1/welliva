/**
 * GozlinCoachMenu — the ⋯ menu, as a menu.
 *
 * WHAT IT REPLACED. These four rows used to open `GozlinActionSheet`: a full
 * bottom sheet, rising 340pt from the bottom of the screen, with a grabber and
 * a title and a subtitle, to hold four one-line commands. That sheet is a good
 * component — it is still the right answer for a confirmation or a picker — and
 * it was the wrong one here for a reason worth writing down:
 *
 *   A SHEET IS A PLACE. It takes over the screen, it has a header, you dismiss
 *   it. Everything about it says "you have gone somewhere". Tapping an overflow
 *   button in the top-right corner and being sent to the bottom of the screen
 *   is a round trip your eye actually has to make, and the sheet has to be big
 *   enough to be worth the journey — which is why four commands ended up with a
 *   title, a subtitle and 40pt icon plates. The weight came from the container.
 *
 *   A MENU IS AN EXTENSION OF THE BUTTON. It springs out of the control you
 *   pressed, next to your thumb, and it is gone the moment you choose. Nothing
 *   about it is a destination, so nothing about it needs framing.
 *
 * SO IT GROWS FROM THE CORNER IT BELONGS TO. `transformOrigin: "top right"`
 * pins the scale to the ⋯ button, so the panel unfolds from the control rather
 * than appearing next to it — the one detail that separates a real menu from a
 * card that faded in nearby. Rows arrive on a stagger off the SAME clock (the
 * suggestion bar's trick: one shared value, each row reading its own window out
 * of it) so the list assembles instead of blinking on.
 *
 * IT SAYS WHERE YOU ARE FIRST. The strip at the top is this conversation in
 * three figures — how long it is, how many are filed, how much Gozlin has been
 * told. Two of the four rows below act on exactly those numbers, so "New
 * conversation" and "Clear memory" stop being abstract verbs: you can see what
 * they are about to move.
 *
 * ACCESSIBILITY IS NOT THE ANIMATION. The scrim is a labelled Close button, the
 * hardware back key is wired, and every row carries its caption in its label —
 * the spring is decoration over a plain, reachable list.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { ActionSheetOption } from "./GozlinActionSheet";

/** One figure in the strip at the top. */
export interface CoachMenuStat {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  options: ActionSheetOption[];
  /** Distance from the top of the screen to the menu's top edge, in points. */
  top: number;
  stats?: CoachMenuStat[];
}

/** Under-damped just enough to land with authority, never to wobble. */
const OPEN_SPRING = { damping: 18, stiffness: 260, mass: 0.75 } as const;
/** Closing is faster than opening — a dismissal should feel decided. */
const CLOSE_MS = 140;
/** How much of the open clock each row waits before starting. */
const ROW_STAGGER = 0.07;
/** How much of the clock a single row's own entrance takes. */
const ROW_WINDOW = 0.55;

export function GozlinCoachMenu({ visible, onClose, options, top, stats }: Props) {
  const { colors, isDark } = useColors();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  /**
   * The row that was picked, held until this panel is actually gone.
   *
   * ── WHY THE ACTION CANNOT RUN ON THE TAP ────────────────────────────────
   *
   * This menu is a `Modal`, and React Native will not present a second Modal
   * while a first one is still mounted — it simply never appears, with no
   * error and no warning. Three of these rows (Chat history, Delete this chat,
   * Clear memory) do nothing except raise a sheet, which is another Modal.
   *
   * It used to fire them on a guessed `setTimeout(…, CLOSE_MS - 40)` — 100ms,
   * against a close animation that runs for CLOSE_MS and only unmounts on its
   * completion callback. The guess was always short, so the sheet was always
   * requested over a live modal: tapping "Delete this chat" or "Chat history"
   * did nothing whatsoever, because the confirmation and the history list were
   * being asked to open behind a panel that had not finished leaving.
   *
   * So the pick is PARKED here and run from `finishClose`, once the panel has
   * genuinely unmounted — the same contract `ui/Sheet` exposes as `onClosed`,
   * for the same reason. No delay is guessed; the animation says when.
   */
  const pickedRef = useRef<ActionSheetOption | null>(null);

  const finishClose = useCallback(() => {
    setMounted(false);
    const picked = pickedRef.current;
    pickedRef.current = null;
    picked?.onPress();
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, OPEN_SPRING);
    } else if (mounted) {
      progress.value = withTiming(
        0,
        { duration: CLOSE_MS, easing: Easing.in(Easing.quad) },
        (done) => {
          if (done) runOnJS(finishClose)();
        },
      );
    }
  }, [visible, mounted, progress, finishClose]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.6),
    transform: [
      { scale: 0.88 + progress.value * 0.12 },
      // A few points of rise, so the panel arrives rather than inflates.
      { translateY: (1 - progress.value) * -6 },
    ],
  }));

  const handlePick = useCallback(
    (opt: ActionSheetOption) => {
      Haptics.selectionAsync().catch(() => {});
      // Parked, not run — see `pickedRef`. It fires when the panel is gone.
      pickedRef.current = opt;
      onClose();
    },
    [onClose],
  );

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView
          intensity={isDark ? 22 : 16}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.32) }]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            top,
            backgroundColor: colors.surfaceElevated,
            borderColor: alpha(colors.borderStrong, 0.7),
          },
          panelStyle,
        ]}
      >
        {stats && stats.length > 0 ? (
          <View style={[styles.stats, { borderBottomColor: colors.divider }]}>
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 ? (
                  <View style={[styles.statRule, { backgroundColor: colors.divider }]} />
                ) : null}
                <View style={styles.stat}>
                  <AppText variant="headline" weight="700">
                    {s.value}
                  </AppText>
                  <AppText variant="caption" color="tertiary" numberOfLines={1}>
                    {s.label}
                  </AppText>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : null}

        <View style={styles.rows}>
          {options.map((opt, i) => {
            const rule = opt.destructive && i > 0 && !options[i - 1].destructive;
            return (
              <React.Fragment key={opt.key}>
                {rule ? (
                  <View style={[styles.rule, { backgroundColor: colors.divider }]} />
                ) : null}
                <MenuRow option={opt} index={i} progress={progress} onPick={handlePick} />
              </React.Fragment>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

function MenuRow({
  option,
  index,
  progress,
  onPick,
}: {
  option: ActionSheetOption;
  index: number;
  progress: SharedValue<number>;
  onPick: (opt: ActionSheetOption) => void;
}) {
  const { colors } = useColors();
  const tint = option.tone ?? (option.destructive ? colors.error : colors.primary);

  const style = useAnimatedStyle(() => {
    // This row's own 0→1, cut out of the shared clock. Rows past the end of the
    // window simply arrive at rest — the stagger can never outlast the open.
    const start = index * ROW_STAGGER;
    const t = Math.min(1, Math.max(0, (progress.value - start) / ROW_WINDOW));
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 10 }],
    };
  }, [index]);

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={() => onPick(option)}
        accessibilityRole="button"
        accessibilityLabel={
          option.caption ? `${option.label}. ${option.caption}` : option.label
        }
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: alpha(colors.text, 0.07) },
        ]}
      >
        {option.icon ? (
          <View style={[styles.icon, { backgroundColor: alpha(tint, 0.15) }]}>
            <Ionicons name={option.icon} size={17} color={tint} />
          </View>
        ) : null}

        <View style={styles.rowText}>
          <AppText
            variant="body"
            weight="600"
            numberOfLines={1}
            style={option.destructive ? { color: colors.error } : undefined}
          >
            {option.label}
          </AppText>
          {option.caption ? (
            <AppText variant="caption" color="tertiary" numberOfLines={1}>
              {option.caption}
            </AppText>
          ) : null}
        </View>

        {option.badge ? (
          <View style={[styles.badge, { backgroundColor: alpha(colors.text, 0.09) }]}>
            <AppText variant="caption" weight="700" color="secondary">
              {option.badge}
            </AppText>
          </View>
        ) : null}
        {option.navigates ? (
          <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    right: Spacing.screen,
    // Wide enough for a caption to sit on one line, narrow enough to still read
    // as a menu hanging off a button rather than as a panel.
    width: 268,
    maxWidth: "86%",
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    // The whole panel scales out of the control that opened it.
    transformOrigin: "top right",
    overflow: "hidden",
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: "center", gap: 1 },
  statRule: { width: StyleSheet.hairlineWidth, height: 24 },

  rows: { gap: 1 },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
    marginHorizontal: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 1 },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignItems: "center",
  },
});
