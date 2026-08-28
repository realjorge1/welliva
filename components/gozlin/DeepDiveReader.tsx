/**
 * DeepDiveReader — the reading behind one coach reply.
 *
 * The surface half of services/gozlin/agent/deepDive.ts. Read that file's
 * header for why a dive is a different KIND of writing from a coach reply.
 *
 * ── WHY THIS IS NOT A BOTTOM SHEET ──────────────────────────────────────────
 *
 * It was one, and it was wrong, in a way worth writing down because the pull to
 * reach for `ui/Sheet` is strong and usually correct.
 *
 * A SHEET IS FOR A DECISION. It rises over the thing you were doing, holds a
 * choice or a short piece of context, and gets out of the way — which is why it
 * keeps the page visible behind it and wears a grabber saying "flick me away".
 * Four hundred words of research is not a decision. Put a document in that
 * container and you get the worst of both: a sheet grown to 88% of the screen
 * (so the "context behind it" is a 60pt sliver of nothing), a drag handle over
 * a scroll view it has to arbitrate with, and a title row squeezed into the
 * space a grabber left it. That reads as a modal someone stretched, because
 * that is exactly what it is.
 *
 * A DOCUMENT WANTS A PLACE TO BE READ. So this takes the whole screen and is
 * laid out like something published: a masthead carrying the question in full
 * (the sheet truncated it to one line of footnote — the single worst detail in
 * the old design, since the question IS the title), section headings at a real
 * size, one reading column, and a hairline of progress along the top so a long
 * piece tells you how much is left.
 *
 * ── THE DETAILS THAT DO THE WORK ────────────────────────────────────────────
 *
 * ONE ACCENT, SPENT DELIBERATELY. Brand colour appears on three marks and never
 * on prose: the progress hairline, the short rule under the masthead, and the
 * dash beside each section heading. The first pass put gold on every heading,
 * every bullet and a header plate — accent everywhere is the same as accent
 * nowhere, and it is most of what made it read as a template.
 *
 * THE BODY IS SECONDARY, THE LEAD IS NOT. Four hundred words at full contrast
 * on an OLED-black canvas is a wall. The opening paragraph carries primary
 * text and a slightly larger size, everything after it steps down one — the
 * hierarchy does the inviting, so the type never has to shout.
 *
 * IT OPENS AS A MOVEMENT. A rise and a fade on one spring, a drag-down on the
 * bar to dismiss, and the title fades into that bar only once the masthead has
 * scrolled away — the chrome earns its place instead of being there from the
 * first frame.
 *
 * ACCESSIBILITY NEVER RIDES ON THE GESTURE: the close button is a real labelled
 * button and the hardware back key is wired. The drag is the fast path.
 */

import { AppText, Button } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { copyText } from "@/utils/clipboard";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseDive } from "./diveMarkup";

/** What the reader is doing right now. */
export type DeepDiveState = "loading" | "ready" | "locked" | "error";

interface Props {
  visible: boolean;
  onClose: () => void;
  state: DeepDiveState;
  /** The dive itself, in the light markup. Streams in while `loading`. */
  text?: string;
  /** The question that produced the reply — the piece's title. */
  subject?: string;
  /** True when the failure was a dead network rather than a declined answer. */
  offline?: boolean;
  onUpgrade: () => void;
  onRetry?: () => void;
}

const OPEN_SPRING = { damping: 22, stiffness: 240, mass: 0.9 } as const;
const CLOSE_MS = 170;
/** Drag distance past which release dismisses, in points. */
const DISMISS_DISTANCE = 90;
/** Downward flick speed that dismisses regardless of distance. */
const DISMISS_VELOCITY = 800;
/** How long the copy tick stays before the icon returns. */
const COPIED_MS = 1600;

export function DeepDiveReader({
  visible,
  onClose,
  state,
  text,
  subject,
  offline,
  onUpgrade,
  onRetry,
}: Props) {
  const { colors } = useColors();
  const blocks = useMemo(() => parseDive(text ?? ""), [text]);

  // 0 = gone, 1 = seated. Drives the ground's fade and the page's rise together.
  const enter = useSharedValue(0);
  /** Live finger offset during a dismiss drag, in points. */
  const drag = useSharedValue(0);
  /** How far through the piece the reader is, 0→1. */
  const read = useSharedValue(0);
  /** Scroll offset, for the bar's title. */
  const offsetY = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishClose = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      read.value = 0;
      offsetY.value = 0;
      enter.value = withSpring(1, OPEN_SPRING);
    } else if (mounted) {
      enter.value = withTiming(
        0,
        { duration: CLOSE_MS, easing: Easing.in(Easing.quad) },
        (done) => {
          if (done) runOnJS(finishClose)();
        },
      );
    }
  }, [visible, mounted, enter, drag, read, offsetY, finishClose]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (!text || !copyText(text)) return;
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [text]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const span = e.contentSize.height - e.layoutMeasurement.height;
    offsetY.value = y;
    read.value = span > 8 ? Math.min(1, Math.max(0, y / span)) : 0;
  });

  // The drag lives on the bar, never the page: a scrolling body would otherwise
  // have to arbitrate between the scroll and the dismiss on every touch.
  const dismissPan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        drag.value = withSpring(0, OPEN_SPRING);
      }
    });

  const groundStyle = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - Math.min(1, Math.max(0, drag.value) / 500)),
  }));

  const pageStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6),
    transform: [{ translateY: interpolate(enter.value, [0, 1], [26, 0]) + drag.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: read.value }],
  }));

  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offsetY.value, [56, 104], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(offsetY.value, [56, 104], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  if (!mounted) return null;

  const isPoster = state === "locked" || state === "error";

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Gestures inside a Modal need their own root — the app's outer one does
          not reach into the modal's native view hierarchy. */}
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, groundStyle]}
        >
          {/* A breath of brand at the top edge, so the masthead sits on
              something rather than floating on flat black. */}
          <LinearGradient
            colors={[alpha(colors.primary, 0.09), "transparent"]}
            style={styles.wash}
            pointerEvents="none"
          />
        </Animated.View>

        <Animated.View style={[styles.flex, pageStyle]}>
          <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
            <GestureDetector gesture={dismissPan}>
              <View style={styles.bar}>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={({ pressed }) => [styles.barBtn, pressed && { opacity: 0.55 }]}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>

                {/* The title arrives in the bar only once the masthead has gone
                    — chrome that earns its place rather than announcing itself. */}
                <Animated.View style={[styles.barTitle, barTitleStyle]} pointerEvents="none">
                  <AppText variant="footnote" weight="600" color="secondary" numberOfLines={1}>
                    {subject || "Deep dive"}
                  </AppText>
                </Animated.View>

                {state === "ready" && text ? (
                  <Pressable
                    onPress={handleCopy}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={copied ? "Copied" : "Copy this deep dive"}
                    style={({ pressed }) => [styles.barBtn, pressed && { opacity: 0.55 }]}
                  >
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={19}
                      color={copied ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                ) : (
                  <View style={styles.barBtn} />
                )}
              </View>
            </GestureDetector>

            {/* Reading progress. One hairline, the only moving thing on screen. */}
            <View style={[styles.progressTrack, { backgroundColor: colors.divider }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary },
                  progressStyle,
                ]}
              />
            </View>

            {isPoster ? (
              <Poster
                state={state}
                offline={offline}
                onUpgrade={onUpgrade}
                onRetry={onRetry}
              />
            ) : (
              <Animated.ScrollView
                style={styles.flex}
                contentContainerStyle={styles.column}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
              >
                <View style={styles.masthead}>
                  <AppText variant="caption" color="tertiary" style={styles.kicker}>
                    THE READING BEHIND
                  </AppText>
                  <AppText variant="title" style={styles.headline}>
                    {subject || "What Gozlin just told you"}
                  </AppText>
                  <View style={[styles.mastRule, { backgroundColor: colors.primary }]} />
                </View>

                {blocks.length === 0 ? (
                  <ReadingSkeleton />
                ) : (
                  blocks.map((b, i) =>
                    b.kind === "heading" ? (
                      <View key={i} style={styles.section}>
                        <View
                          style={[styles.sectionMark, { backgroundColor: colors.primary }]}
                        />
                        <AppText variant="headline" weight="700">
                          {b.text}
                        </AppText>
                      </View>
                    ) : b.kind === "bullet" ? (
                      <View key={i} style={styles.bulletRow}>
                        <View
                          style={[styles.bulletDash, { backgroundColor: colors.textTertiary }]}
                        />
                        <AppText variant="bodyLg" color="secondary" style={styles.bulletText}>
                          {b.text}
                        </AppText>
                      </View>
                    ) : (
                      <AppText
                        key={i}
                        variant="bodyLg"
                        // The opening paragraph is the invitation: full contrast
                        // and a touch larger. Everything after steps down one.
                        color={i === 0 ? "primary" : "secondary"}
                        style={i === 0 ? styles.lead : styles.para}
                      >
                        {b.text}
                      </AppText>
                    ),
                  )
                )}

                {state === "loading" && blocks.length > 0 ? (
                  <StreamingCaret />
                ) : null}

                {/* The line that keeps two kinds of number apart — see the
                    grounding note in services/gozlin/agent/deepDive.ts. */}
                <View
                  style={[
                    styles.colophon,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Ionicons name="library-outline" size={15} color={colors.textTertiary} />
                  <AppText variant="footnote" color="tertiary" style={styles.colophonText}>
                    General research and consensus — not your logged data, and not
                    medical advice.
                  </AppText>
                </View>
              </Animated.ScrollView>
            )}
          </SafeAreaView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * The two states with nothing to read.
 *
 * Centred and set like a title page rather than left-aligned like a form: there
 * is one sentence and one button here, and a lone paragraph pinned to the top
 * left of a full screen is what "unfinished" looks like.
 */
function Poster({
  state,
  offline,
  onUpgrade,
  onRetry,
}: {
  state: DeepDiveState;
  offline?: boolean;
  onUpgrade: () => void;
  onRetry?: () => void;
}) {
  const { colors } = useColors();
  const locked = state === "locked";

  return (
    <View style={styles.poster}>
      <View style={[styles.posterMark, { borderColor: alpha(colors.primary, 0.35) }]}>
        <Ionicons
          name={locked ? "library-outline" : offline ? "cloud-offline-outline" : "refresh-outline"}
          size={26}
          color={colors.primary}
        />
      </View>

      <AppText variant="caption" color="tertiary" style={styles.kicker}>
        DEEP DIVE
      </AppText>
      <AppText variant="title" style={styles.posterTitle}>
        {locked
          ? "The reading behind the answer"
          : offline
            ? "This part needs a connection"
            : "That didn't come together"}
      </AppText>
      <AppText variant="bodyLg" color="secondary" style={styles.posterBody}>
        {locked
          ? "Plus opens the evidence behind everything Gozlin tells you — what the research actually shows, the effect sizes, and the caveats that matter."
          : offline
            ? "Your coach still works offline. The reading behind an answer doesn't."
            : "Nothing was lost. Give it another moment."}
      </AppText>

      <View style={styles.posterCta}>
        {locked ? (
          <Button label="Upgrade to Plus" onPress={onUpgrade} fullWidth />
        ) : onRetry ? (
          <Button label="Try again" variant="tonal" onPress={onRetry} fullWidth />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The wait. Lines of "text" breathing on one clock, under a masthead that is
 * already filled in — the question is known before the answer is, so the page
 * is never blank and the wait reads as writing rather than as loading.
 */
function ReadingSkeleton() {
  const { colors } = useColors();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.16, 0.4]),
  }));

  const widths = ["100%", "96%", "88%", "100%", "72%", "94%", "100%", "60%"] as const;

  return (
    <View style={styles.skeleton}>
      <AppText variant="footnote" color="tertiary" style={styles.skeletonLabel}>
        Reading up on this…
      </AppText>
      {widths.map((w, i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonBar,
            { width: w, backgroundColor: colors.text, marginTop: i === 4 ? 26 : 12 },
            style,
          ]}
        />
      ))}
    </View>
  );
}

/** The blinking end of a line still being written. */
function StreamingCaret() {
  const { colors } = useColors();
  const blink = useSharedValue(0);

  useEffect(() => {
    blink.value = withRepeat(withTiming(1, { duration: 620 }), -1, true);
  }, [blink]);

  const style = useAnimatedStyle(() => ({ opacity: interpolate(blink.value, [0, 1], [0.2, 1]) }));

  return (
    <Animated.View
      style={[styles.caret, { backgroundColor: colors.primary }, style]}
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** The brand breath behind the masthead. */
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 260 },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    height: 48,
  },
  barBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  barTitle: { flex: 1, alignItems: "center", paddingHorizontal: Spacing.sm },

  progressTrack: { height: 2, width: "100%", overflow: "hidden" },
  /** Scaled from the left edge, so the fill grows rather than slides. */
  progressFill: { height: 2, width: "100%", transformOrigin: "left center" },

  /**
   * ONE READING COLUMN, and wider gutters than any other screen in the app.
   *
   * `Spacing.screen` is 12 — deliberately thin, so cards and lists run
   * near-edge-to-edge. That is right for a dashboard and wrong for prose: at
   * 12pt the line runs about 68 characters, past the top of the comfortable
   * range, and long lines are the reason people abandon a piece halfway.
   * 24pt brings it to roughly 62 and, not incidentally, makes this screen
   * feel like a different kind of place the moment it opens.
   */
  column: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },

  masthead: { marginBottom: Spacing.lg },
  kicker: { letterSpacing: 1.6 },
  headline: { marginTop: Spacing.sm },
  /** A short rule, not a full-width divider: a mark, not a separation. */
  mastRule: { width: 34, height: 2, borderRadius: 1, marginTop: Spacing.md },

  section: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: Spacing.xxxl },
  sectionMark: { width: 14, height: 2, borderRadius: 1 },

  lead: { marginTop: Spacing.md, fontSize: 17, lineHeight: 29 },
  para: { marginTop: Spacing.md, lineHeight: 27 },

  bulletRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  bulletDash: { width: 10, height: 1.5, borderRadius: 1, marginTop: 13 },
  bulletText: { flex: 1, lineHeight: 27 },

  caret: { width: 2, height: 20, borderRadius: 1, marginTop: Spacing.md },

  colophon: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xxxl,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  colophonText: { flex: 1, lineHeight: 18 },

  poster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  posterMark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  posterTitle: { marginTop: Spacing.sm, textAlign: "center" },
  posterBody: { marginTop: Spacing.md, textAlign: "center", lineHeight: 27 },
  posterCta: { alignSelf: "stretch", marginTop: Spacing.xl },

  skeleton: { paddingTop: Spacing.xs },
  skeletonLabel: { marginBottom: Spacing.sm },
  skeletonBar: { height: 12, borderRadius: 6 },
});
