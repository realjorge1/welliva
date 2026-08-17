/**
 * SIDE MENU — the panel behind the app.
 *
 * Identity first (photo, name, the one line that says who this person is to
 * Welliva), then the destinations in the order they were specified, then the two
 * exploratory surfaces below a hairline, then Settings pinned to the floor.
 *
 * EVERYTHING MOVES OFF `progress`, not off mount. The panel's parallax, its
 * scale and fade, and each row's own staggered slide are all interpolations of
 * the drawer's shared value — so they play in reverse, at your speed, while your
 * finger is still on the glass. A mount-time entrance animation would look
 * correct on a button tap and completely wrong on a drag, which is the whole
 * reason this is built on a shared value instead of `Reveal`.
 *
 * THE ONE EXCEPTION IS THE COLD-START BOUNCE (`playIntro`). The very first time
 * the menu opens in a launch, the rows spring in with a soft overshoot on top of
 * the progress-driven reveal — the app introducing itself. Every open after that
 * is the plain reveal again, because a bounce you see forty times a day is not a
 * flourish, it's a tax. The latch that decides this lives in AppDrawer, at
 * module scope, so it resets when the app is killed and not before.
 *
 * ACTIVE ROWS ARE NOT PLATES — THEY ARE BIGGER. The current screen is marked by
 * gold on both the mark and the label, a heavy weight, and a genuine jump in
 * size; there is no pill behind it. A tinted background reads as a button ("tap
 * here"), the opposite of what "you're already here" should say, whereas scale
 * is read instantly and from across the room.
 *
 * The mark slot is a FIXED width sized for the ACTIVE glyph, not for the one
 * it's currently showing. That's what keeps every label on one left edge as you
 * navigate — size the slot to its contents and the whole column jogs sideways
 * each time the active row moves.
 */

import { GozlinAvatar } from "@/components/gozlin/GozlinAvatar";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_HAIRLINE, MENU_PARALLAX, MENU_SURFACE } from "./DrawerContext";
import {
  PRIMARY_ITEMS,
  PROFILE_ITEM,
  SECONDARY_ITEMS,
  SETTINGS_ITEM,
  type MenuItem,
} from "./menu";
import { useAccountIdentity } from "./useAccountIdentity";

export interface SideMenuProps {
  progress: SharedValue<number>;
  width: number;
  /** Current pathname, so exactly one row can read as active. */
  activePath: string;
  onNavigate: (item: MenuItem) => void;
  /** First open of this launch — play the entrance bounce. See the header. */
  playIntro?: boolean;
}

/* Row stagger: each row's fade-in window starts slightly later than the last,
 * and all of them have finished before the drawer is fully out. */
const STAGGER_STEP = 0.03;
const STAGGER_WINDOW = 0.55;

/* ── The cold-start bounce ────────────────────────────────────────────────
 * Under-damped on purpose: ζ ≈ 0.35, so each row carries about 30% of its
 * travel PAST its resting place before settling back. The first pass at this
 * was ζ ≈ 0.49 over 16pt — three points of overshoot, which is arithmetic
 * rather than motion. Amplitude is what makes a bounce read; the softness comes
 * from the low stiffness, not from making it small.
 */
const INTRO_SPRING = {
  damping: 8,
  stiffness: 150,
  mass: 0.85,
} as const;
/**
 * Milliseconds between one row's bounce and the next — the cascade. Long enough
 * that you can see it travel down the panel rather than land as one block; the
 * opacity gate below is what lets it run on past the drawer's own settle
 * without leaving rows visibly parked mid-air.
 */
const INTRO_STAGGER = 32;
/** How far left of home a row starts its bounce. */
const INTRO_SLIDE = 36;

export function SideMenu({
  progress,
  width,
  activePath,
  onNavigate,
  playIntro = false,
}: SideMenuProps) {
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.35, 1],
      [0, 0.65, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-width * MENU_PARALLAX, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(progress.value, [0, 1], [0.94, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  // One running index across all three groups, so the stagger reads as a single
  // cascade down the panel rather than three restarts.
  let row = 0;

  return (
    <Animated.View
      style={[styles.panel, { width, backgroundColor: MENU_SURFACE }, panelStyle]}
    >
      <SafeAreaView style={styles.flex} edges={["top", "bottom", "left"]}>
        <ProfileHeader
          progress={progress}
          onPress={() => onNavigate(PROFILE_ITEM)}
          active={activePath === PROFILE_ITEM.href}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {PRIMARY_ITEMS.map((item) => (
            <Row
              key={item.route}
              item={item}
              index={row++}
              progress={progress}
              playIntro={playIntro}
              active={activePath === item.href}
              onPress={() => onNavigate(item)}
            />
          ))}

          <View style={styles.hairline} />

          {SECONDARY_ITEMS.map((item) => (
            <Row
              key={item.route}
              item={item}
              index={row++}
              progress={progress}
              playIntro={playIntro}
              active={activePath === item.href}
              onPress={() => onNavigate(item)}
              muted
            />
          ))}
        </ScrollView>

        {/* Settings — pinned to the floor, alone, so there is exactly one door
            to it and it never scrolls out of reach. */}
        <View style={styles.footer}>
          <Row
            item={SETTINGS_ITEM}
            index={row}
            progress={progress}
            playIntro={playIntro}
            active={activePath === SETTINGS_ITEM.href}
            onPress={() => onNavigate(SETTINGS_ITEM)}
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

/* ──────────────────────────── Profile header ───────────────────────────── */

function ProfileHeader({
  progress,
  onPress,
  active,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
  active: boolean;
}) {
  const { colors } = useColors();
  const { name, photo, subtitle } = useAccountIdentity();

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 0.6],
          [-20, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name} — open profile`}
        style={({ pressed }) => [
          styles.profile,
          // Same rule as the rows: being here is said in gold, never with a
          // plate. See the file header.
          pressed && { opacity: 0.7 },
        ]}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={[
              styles.avatar,
              { borderColor: alpha(colors.primary, active ? 0.75 : 0.35) },
            ]}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${name}'s photo`}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              {
                backgroundColor: alpha(colors.primary, 0.14),
                borderColor: alpha(colors.primary, active ? 0.75 : 0.35),
              },
            ]}
          >
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
        )}

        <View style={styles.flex}>
          {/* The header carries the active treatment in gold and weight only.
              It already outranks every row at 18pt, and growing it further would
              push the bio line and the photo out of alignment. */}
          <AppText
            variant="headline"
            weight={active ? "800" : undefined}
            color={active ? colors.primary : undefined}
            numberOfLines={1}
          >
            {name}
          </AppText>
          <AppText
            variant="footnote"
            color="secondary"
            numberOfLines={1}
            style={styles.profileSub}
          >
            {subtitle}
          </AppText>
        </View>
        {/* No chevron. At this panel width its 24pt is the difference between
            the bio line reading in full and ellipsizing, and a menu's own header
            row doesn't need a hint that it's tappable. */}
      </Pressable>
    </Animated.View>
  );
}

/* ─────────────────────────────────  Row  ───────────────────────────────── */

function Row({
  item,
  index,
  progress,
  playIntro,
  active,
  onPress,
  muted = false,
}: {
  item: MenuItem;
  index: number;
  progress: SharedValue<number>;
  playIntro: boolean;
  active: boolean;
  onPress: () => void;
  muted?: boolean;
}) {
  const { colors } = useColors();

  /* The cold-start bounce, layered ON TOP of the progress reveal below.
   * It rests at 1 so a row that never gets an intro (every open after the
   * first, and any remount) is simply at home — the animation is opt-in, and
   * its absence can never leave a row parked off-screen. */
  const intro = useSharedValue(1);
  useEffect(() => {
    if (!playIntro) return;
    // Armed the instant the drawer starts opening, while the rows are still at
    // zero opacity — so the reset to 0 is never seen, only its spring back.
    intro.value = 0;
    intro.value = withDelay(index * INTRO_STAGGER, withSpring(1, INTRO_SPRING));
  }, [playIntro, index, intro]);

  const style = useAnimatedStyle(() => {
    const start = 0.08 + index * STAGGER_STEP;
    const t = interpolate(
      progress.value,
      [start, Math.min(start + STAGGER_WINDOW, 1)],
      [0, 1],
      Extrapolation.CLAMP,
    );
    // The spring overshoots past 1, which is what carries the row a little
    // beyond home and back — the bounce itself.
    const b = intro.value;
    // A row still waiting out its stagger delay is HIDDEN, not parked: without
    // this the later rows would fade fully in at their pre-bounce offset and sit
    // there until their turn, which reads as a hop rather than a cascade. At
    // rest (b = 1, every open after the first) this is exactly 1 and the reveal
    // is the plain progress-driven one.
    const fade = Math.min(1, Math.max(0, b * 1.6));
    return {
      opacity: t * fade,
      transform: [
        { translateX: (1 - t) * -22 + (1 - b) * -INTRO_SLIDE },
        { scale: 0.93 + b * 0.07 },
      ],
    };
  });

  const tint = active
    ? colors.primary
    : muted
      ? colors.textTertiary
      : colors.textSecondary;

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: alpha(colors.text, 0.05) },
        ]}
      >
        {/* Fixed-width slot, sized for the active glyph — see the file header. */}
        <View style={styles.markSlot}>
          {item.mark === "gozlin" ? (
            // The coach keeps its own mark. Pulsing only when it's the live
            // screen — a breathing icon in a closed menu is just noise.
            <GozlinAvatar size={active ? MARK_ACTIVE : MARK_REST} pulsing={active} />
          ) : (
            <Ionicons
              name={active ? item.activeIcon : item.icon}
              size={active ? MARK_ACTIVE : MARK_REST}
              color={tint}
            />
          )}
        </View>

        <AppText
          variant="body"
          weight={active ? "800" : "500"}
          color={active ? colors.primary : colors.text}
          // Two lines, not an ellipsis: a menu that truncates its own
          // destination is worse than one with a row a few points taller. No
          // label wraps today — the longest is "Settings" — but this used to be
          // load-bearing for "What Welliva knows" (now "Memory"), and it still
          // catches a long future label or a large OS font scale.
          numberOfLines={2}
          style={[styles.rowLabel, active && styles.rowLabelActive]}
        >
          {item.label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** Mark at rest, and the same mark on the screen you're actually looking at. */
const MARK_REST = 21;
const MARK_ACTIVE = 30;

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Sits under the content, anchored to the left edge. `width` comes from the
  // shell so the panel and the content's travel can never disagree.
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },

  /* METRICS ARE TUNED TO A ~49%-WIDTH PANEL. The gutters were made this tight
   * for a label that no longer exists ("What Welliva knows", now "Memory") —
   * the longest is "Settings", which fits with room to spare. They're kept as
   * they are because the panel reads well; there's simply slack now, so nothing
   * here is load-bearing if you want to relax it. */

  // Header
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  profileSub: { marginTop: 1 },

  // List
  list: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    // `minHeight`, not `height`: a label that wraps to two lines has to be able
    // to grow the row instead of being clipped by it.
    minHeight: 46,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  markSlot: { width: MARK_ACTIVE + 1, alignItems: "center" },
  rowLabel: { flex: 1 },
  /**
   * The size half of "you are here" — 15pt body up to 21pt, a jump you read
   * before you read the word. `lineHeight` is set with it so a wrapped label
   * keeps its own rhythm instead of inheriting body's tighter leading.
   *
   * 21pt WAS the ceiling at a 49%-wide panel, set by "What Welliva knows"
   * (now "Memory") truncating on a 360dp phone past that size. With every label
   * short there's headroom to go bigger without widening the panel — this size
   * is now a design choice rather than a limit.
   */
  rowLabelActive: { fontSize: 21, lineHeight: 28 },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: MENU_HAIRLINE,
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.sm,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MENU_HAIRLINE,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
});
