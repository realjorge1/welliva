/**
 * THE DOCK — one slot above the rail, with a priority of tenants.
 *
 *   1. A LIVE ACTIVITY   a guided session you walked away from mid-set. It is
 *                        already happening, so it is drawn as a CONTROLLER —
 *                        a transport button and a real position in a real
 *                        session — and it cannot be dismissed.
 *   2. A TIME-BOUND CUE  the top open prompt. Small, dismissible, carrying a
 *                        count of what else is open so the ladder stops
 *                        pretending it only ever had one idea.
 *   3. A FINISHED DAY    the calm sentence a day with nothing open still owes.
 *                        Outlined, never filled: a finished day should look
 *                        finished, not like an unpressed button.
 *   4. NOTHING           and this is the tenant that matters most. The old bar
 *                        could not be empty, so it always had to say SOMETHING,
 *                        which is how a coach turns into a nag.
 *
 * A CONFIRMATION STACKS ON TOP OF ANY OF THEM rather than replacing one, so a
 * glass of water logged during a live session does not blank the controller for
 * two seconds.
 *
 * DISMISSAL IS A SWIPE, AND THE ONLY NEW GESTURE IN THE DECK. It begins well
 * clear of the drawer's 32pt edge strip, fails to a vertical scroll, and lives
 * outside every ScrollView in the app — so it meets neither the drawer's pan
 * nor the Android elastic pull. What it takes is a LEASE, not a tombstone: see
 * dismissals.ts for why "not now" has to expire on its own.
 */

import { enterFade, exitFade, settleLayout } from "@/components/motion";
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { DECK_GAP } from "./DeckContext";
import type { NextMove } from "./nextMove";

/** Travel past which a release dismisses. */
const DISMISS_DISTANCE = 92;
/** Flick speed that dismisses regardless of distance. */
const DISMISS_VELOCITY = 620;
/** How far off-screen a dismissed card finishes. */
const FLING = 420;

const SWIPE_SPRING = { damping: 22, stiffness: 260, mass: 0.9 } as const;

/* ─────────────────────── the card's vertical rhythm ───────────────────────
 * CENTRED ON THE CONTENT ROW, NOT ON THE INK.
 *
 * The card carries a drag handle, and a handle makes the top gap bigger than
 * the bottom one unless you say otherwise: 9 above it, the 4pt bar, then 10
 * below it is 23pt of chrome, against 16pt of padding underneath. The handle
 * is faint by design, so the eye reads that whole 23 as empty space, weighs it
 * against 16, and the row of text lands visibly low in the card.
 *
 * So the handle is tucked INSIDE the top gap rather than added on top of it:
 * inset + bar + gap comes to exactly the bottom padding, and the content row
 * ends up with the same air above it as below.
 */
/** Card edge → the handle. */
const HANDLE_INSET = 8;
/** The handle itself. */
const HANDLE_BAR = 4;
/** Handle → the content row. */
const HANDLE_GAP = 8;
/** What the top chrome adds up to, and therefore what sits under the row. */
const CARD_PAD_V = HANDLE_INSET + HANDLE_BAR + HANDLE_GAP;

export interface DockProps {
  live: NextMove | null;
  /** The cue, or null when the rail is carrying it (folded) or nothing is open. */
  cue: NextMove | null;
  /** The finished-day sentence, or null when something is open or it was waved away. */
  finished: NextMove | null;
  /** Open prompts other than the cue. Drawn as the card's "N more". */
  more: number;
  /** A one-line receipt, stacked above whatever else is here. */
  confirmation: string | null;
  onRun: (move: NextMove) => void;
  onDismiss: (move: NextMove) => void;
  /** Pull the cue up into the full agenda. */
  onExpand: () => void;
}

/* ─────────────────────────── the swipeable shell ──────────────────────── */

function Swipeable({
  move,
  onDismiss,
  children,
}: {
  move: NextMove;
  onDismiss: (move: NextMove) => void;
  children: React.ReactNode;
}) {
  const dx = useSharedValue(0);

  const finish = useCallback(() => onDismiss(move), [move, onDismiss]);

  // Rebuilt only when the move changes, not on every parent render — the Deck
  // re-renders on the minute tick and on every water tap, and a fresh gesture
  // object each time would tear down and re-register the handler mid-drag.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(move.dismissible)
        // Horizontal intent only, and never at the expense of the list behind
        // it. It also starts well clear of the drawer's 32pt edge strip, so the
        // two pans can never both claim the same touch.
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          dx.value = e.translationX;
        })
        .onEnd((e) => {
          const gone =
            Math.abs(e.translationX) > DISMISS_DISTANCE ||
            Math.abs(e.velocityX) > DISMISS_VELOCITY;
          if (gone) {
            dx.value = withTiming(
              Math.sign(e.translationX || e.velocityX) * FLING,
              { duration: 180 },
              () => runOnJS(finish)(),
            );
          } else {
            dx.value = withSpring(0, SWIPE_SPRING);
          }
        }),
    [move.dismissible, dx, finish],
  );

  // A new tenant arrives at centre, never at wherever the last one was flung.
  useEffect(() => {
    dx.value = 0;
  }, [move.id, dx]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }],
    opacity: interpolate(
      Math.abs(dx.value),
      [0, DISMISS_DISTANCE, DISMISS_DISTANCE * 2],
      [1, 0.75, 0],
      "clamp",
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

/* ───────────────────────────── the card shell ─────────────────────────── */

function Card({
  accent,
  onGrab,
  children,
}: {
  /** A border tint for a live card; undefined keeps the ordinary hairline. */
  accent?: string;
  /** Tapping the grab handle expands; omit it and no handle is drawn. */
  onGrab?: () => void;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useColors();
  return (
    // Opaque, like the rail beneath it — see Rail.tsx's header. A card that is
    // partly see-through over a dark canvas does not read as glass, it reads
    // as content bleeding through a panel that failed to paint.
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: accent ?? colors.borderStrong,
          shadowColor: colors.shadowColor,
          shadowOpacity: isDark ? 0.5 : 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
      ]}
    >
      {onGrab ? (
        <Pressable
          onPress={onGrab}
          accessibilityRole="button"
          accessibilityLabel="Show everything open today"
          hitSlop={10}
          style={styles.grabHit}
        >
          <View style={[styles.grab, { backgroundColor: alpha(colors.text, 0.18) }]} />
        </Pressable>
      ) : (
        <View style={styles.grabHit}>
          <View style={[styles.grab, { backgroundColor: alpha(colors.text, 0.1) }]} />
        </View>
      )}
      {children}
    </View>
  );
}

/** The plate at the left of a row: a move's glyph, or Gozlin's own mark. */
function Plate({ move, tone, size = 38 }: { move: NextMove; tone: string; size?: number }) {
  return (
    <View
      style={[
        styles.plate,
        { width: size, height: size, backgroundColor: alpha(tone, 0.15) },
      ]}
    >
      {move.voice === "gozlin" ? (
        <AILogoIcon size={size * 0.52} color={tone} />
      ) : (
        <Ionicons name={move.icon} size={size * 0.5} color={tone} />
      )}
    </View>
  );
}

/* ──────────────────────────────── the dock ────────────────────────────── */

export function Dock({
  live,
  cue,
  finished,
  more,
  confirmation,
  onRun,
  onDismiss,
  onExpand,
}: DockProps) {
  const { colors } = useColors();

  const run = useCallback(
    (move: NextMove) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onRun(move);
    },
    [onRun],
  );

  const tenant = live ?? cue ?? finished ?? null;

  return (
    // `layout` on the container, so the space a card takes GLIDES open and
    // shut while the card itself fades. Without it the height jumps on the
    // frame the tenant changes and the fade plays into a hole that is already
    // there — which reads as a stutter even though nothing is dropped.
    <Animated.View
      style={styles.dock}
      layout={settleLayout()}
      pointerEvents="box-none"
    >
      {confirmation ? (
        <Animated.View
          entering={enterFade()}
          exiting={exitFade()}
          style={styles.confirmWrap}
        >
          <View
            style={[
              styles.confirm,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <AppText variant="caption" weight="700" numberOfLines={1}>
              {confirmation}
            </AppText>
          </View>
        </Animated.View>
      ) : null}

      {tenant ? (
        <Animated.View
          // Keyed on the tenant so a change of mind reads as a thought rather
          // than a pop — the same rule the old bar's label crossfade followed.
          key={tenant.id}
          entering={enterFade()}
          // NO `exiting`, for the reason the rail has none either: an exiting
          // view stays in flow while it plays, so a cue replaced by another
          // would draw BOTH cards stacked for the length of the fade. The old
          // one goes at once; the container's `layout` carries the height.
          layout={settleLayout()}
        >
          <Swipeable move={tenant} onDismiss={onDismiss}>
            {live ? (
              /* ── 1. The live controller ───────────────────────────────── */
              <Card accent={alpha(colors.primary, 0.34)}>
                <View style={styles.row}>
                  <Pressable
                    onPress={() => run(live)}
                    accessibilityRole="button"
                    accessibilityLabel={live.label}
                    style={({ pressed }) => [styles.transport, pressed && styles.pressed]}
                  >
                    <LinearGradient
                      colors={colors.brandGradient as [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="play" size={18} color={colors.onPrimary} />
                  </Pressable>

                  <View style={styles.text}>
                    <AppText variant="callout" weight="700" numberOfLines={1}>
                      {live.label}
                    </AppText>
                    {live.caption ? (
                      <AppText variant="footnote" color="secondary" numberOfLines={1}>
                        {live.caption}
                      </AppText>
                    ) : null}
                  </View>
                </View>

                {live.segments && live.segments.of > 0 ? (
                  <View style={styles.segments}>
                    {Array.from({ length: live.segments.of }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.segment,
                          {
                            backgroundColor:
                              i < live.segments!.at
                                ? colors.primary
                                : alpha(colors.text, 0.12),
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : cue ? (
              /* ── 2. The cue ───────────────────────────────────────────── */
              <Card onGrab={more > 0 ? onExpand : undefined}>
                <Pressable
                  onPress={() => run(cue)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    cue.caption ? `${cue.label}. ${cue.caption}` : cue.label
                  }
                  accessibilityHint={
                    cue.dismissible ? "Swipe sideways to put it off" : undefined
                  }
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Plate move={cue} tone={colors.primary} />
                  <View style={styles.text}>
                    <AppText variant="callout" weight="700" numberOfLines={1}>
                      {cue.label}
                    </AppText>
                    {cue.caption ? (
                      <AppText variant="footnote" color="secondary" numberOfLines={1}>
                        {cue.caption}
                      </AppText>
                    ) : null}
                  </View>

                  {more > 0 ? (
                    <Pressable
                      onPress={onExpand}
                      accessibilityRole="button"
                      accessibilityLabel={`${more} more open today`}
                      hitSlop={8}
                      style={[
                        styles.more,
                        { backgroundColor: alpha(colors.text, 0.06), borderColor: colors.border },
                      ]}
                    >
                      <AppText variant="caption" weight="700" color="secondary">
                        {more} more
                      </AppText>
                      <Ionicons name="chevron-up" size={13} color={colors.textSecondary} />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
                  )}
                </Pressable>
              </Card>
            ) : (
              /* ── 3. The finished day ──────────────────────────────────── */
              <Pressable
                onPress={() => finished && run(finished)}
                accessibilityRole="button"
                accessibilityLabel={
                  finished?.caption
                    ? `${finished.label}. ${finished.caption}`
                    : finished?.label
                }
                style={({ pressed }) => [styles.doneWrap, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.done,
                    { backgroundColor: alpha(colors.text, 0.05), borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name={finished!.icon}
                    size={15}
                    color={colors.textSecondary}
                  />
                  {/* Both shrink: React Native defaults `flexShrink` to 0, so
                      a long "Tomorrow: Upper Body Strength" ran off the end of
                      the strip instead of truncating. */}
                  <AppText
                    variant="footnote"
                    weight="600"
                    color="secondary"
                    numberOfLines={1}
                    style={styles.shrink}
                  >
                    {finished!.label}
                  </AppText>
                  {finished!.caption ? (
                    <AppText
                      variant="footnote"
                      color="tertiary"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.shrink}
                    >
                      · {finished!.caption}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            )}
          </Swipeable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { marginBottom: DECK_GAP },

  confirmWrap: { alignItems: "center", marginBottom: Spacing.xs + 2 },
  confirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "92%",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingBottom: CARD_PAD_V,
  },
  grabHit: {
    alignItems: "center",
    paddingTop: HANDLE_INSET,
    paddingBottom: HANDLE_GAP,
  },
  grab: { width: 34, height: HANDLE_BAR, borderRadius: 2 },

  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 4 },
  text: { flex: 1, gap: 2 },
  /** RN's flexShrink defaults to 0 — anything that may truncate needs this. */
  shrink: { flexShrink: 1, minWidth: 0 },

  plate: { borderRadius: 13, alignItems: "center", justifyContent: "center" },

  transport: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  segments: { flexDirection: "row", gap: 4, marginTop: Spacing.sm + 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },

  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  doneWrap: { alignItems: "center" },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: "100%",
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  pressed: { opacity: 0.9 },
});
