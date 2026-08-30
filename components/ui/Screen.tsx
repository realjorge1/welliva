/**
 * Screen — consistent page scaffold: a full-bleed ambient gradient canvas,
 * safe area, optional scroll, standard gutters, and a bottom inset that clears
 * the floating bottom nav.
 *
 * The gradient canvas is the heart of the calm/wellbeing look — every screen
 * floats its content over a soft twilight wash rather than a flat color. Pass
 * `gradient={false}` for screens that paint their own immersive background
 * (e.g. the auth canvas or the live guided session).
 */
import { Spacing } from "@/constants/theme";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Edge, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientCanvas } from "./AmbientCanvas";
import { useColors } from "./useColors";
import { useElasticScroll } from "./useElasticScroll";

/**
 * Bottom clearance for the last card on a page.
 *
 * It was reserved for the floating tab bar. That bar is gone — navigation is the
 * swipe menu now — but the space still earns its keep: it's what the Gozlin FAB
 * floats in on Home, Diet and Fitness, and what keeps the final row off the home
 * indicator everywhere else.
 *
 * A screen that floats nothing over its footer should pass its own, much
 * smaller `bottomInset` rather than inherit this — see the prop.
 */
export const NAV_CLEARANCE = 120;

/**
 * The floor under any `bottomInset`, added to the device's own bottom inset.
 * `edges` defaults to `["top"]`, so the safe area at the bottom is the content's
 * problem — this is what stops a small inset from tucking the last card under
 * the home indicator.
 */
const MIN_BOTTOM_GAP = Spacing.md;

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Horizontal gutter applied to content. Set false to manage your own. */
  gutter?: boolean;
  /** Render the ambient gradient canvas behind content (default true). */
  gradient?: boolean;
  /**
   * Static header pinned above the scroll region — stays put while `children`
   * scroll beneath it. Shares the same gutter as the content, no divider, so
   * the page reads as one continuous surface.
   */
  header?: React.ReactNode;
  /**
   * Pinned over the bottom edge, outside the scroll region — the Action Bar's
   * home. Passing one also raises the default `bottomInset` to `NAV_CLEARANCE`,
   * so a screen can never float a control over its own last card: the clearance
   * and the thing needing clearance are declared in the same place.
   *
   * It's laid out `pointerEvents="box-none"`, so the strip either side of a
   * floating control stays transparent to touches and the content beneath it
   * remains scrollable.
   */
  footer?: React.ReactNode;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Forwarded to the scroll region (throttled to 16ms) for scroll-driven UI. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Space below the last item, in points. Defaults to `NAV_CLEARANCE`, which is
   * generous because it is sized for the screens that float something over it.
   * Pass a small number on a page whose footer is just the end of the content —
   * the device's own bottom inset is still honoured underneath it.
   */
  bottomInset?: number;
}

export function Screen({
  children,
  scroll = true,
  gutter = true,
  gradient = true,
  header,
  footer,
  edges = ["top"],
  contentStyle,
  refreshing,
  onRefresh,
  onScroll,
  bottomInset,
}: ScreenProps) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  const padding: StyleProp<ViewStyle> = gutter
    ? { paddingHorizontal: Spacing.screen }
    : undefined;

  /**
   * A footer FORCES at least the nav clearance, whatever the screen asked for.
   * Screens that trimmed their inset when nothing floated over them (Home) then
   * get the room back automatically the moment one does, instead of the last
   * card quietly sliding under a control someone added months later.
   */
  const inset = footer
    ? Math.max(bottomInset ?? 0, NAV_CLEARANCE)
    : (bottomInset ?? NAV_CLEARANCE);

  // Pull-to-refresh already owns the drag-down-from-the-top gesture, so a
  // screen that has one can't also have the elastic pull.
  const elastic = useElasticScroll({ enabled: !onRefresh, onScroll });

  const stickyHeader = header ? <View style={padding}>{header}</View> : null;

  const body = !scroll ? (
    <SafeAreaView style={styles.flex} edges={edges}>
      {stickyHeader}
      <View style={[styles.flex, padding, contentStyle]}>{children}</View>
    </SafeAreaView>
  ) : (
    <SafeAreaView style={styles.flex} edges={edges}>
      {stickyHeader}
      {elastic.wrap(
        <ScrollView
          showsVerticalScrollIndicator={false}
          {...elastic.scrollProps}
          contentContainerStyle={[
            { paddingBottom: Math.max(inset, insets.bottom + MIN_BOTTOM_GAP) },
            padding,
            contentStyle,
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>,
      )}
    </SafeAreaView>
  );

  // Outside `body`, so it is a sibling of the scroll region rather than a child
  // of it — a footer inside the ScrollView would scroll away with the content.
  const pinnedFooter = footer ? (
    <View style={styles.footer} pointerEvents="box-none">
      {footer}
    </View>
  ) : null;

  if (!gradient) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {body}
        {pinnedFooter}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      {body}
      {pinnedFooter}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
