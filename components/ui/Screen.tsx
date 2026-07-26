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
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { AmbientCanvas } from "./AmbientCanvas";
import { useColors } from "./useColors";

/** Clearance so the last card never hides behind the floating tab bar. */
export const NAV_CLEARANCE = 120;

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
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Forwarded to the scroll region (throttled to 16ms) for scroll-driven UI. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function Screen({
  children,
  scroll = true,
  gutter = true,
  gradient = true,
  header,
  edges = ["top"],
  contentStyle,
  refreshing,
  onRefresh,
  onScroll,
}: ScreenProps) {
  const { colors } = useColors();
  const padding: StyleProp<ViewStyle> = gutter
    ? { paddingHorizontal: Spacing.screen }
    : undefined;

  const stickyHeader = header ? <View style={padding}>{header}</View> : null;

  const body = !scroll ? (
    <SafeAreaView style={styles.flex} edges={edges}>
      {stickyHeader}
      <View style={[styles.flex, padding, contentStyle]}>{children}</View>
    </SafeAreaView>
  ) : (
    <SafeAreaView style={styles.flex} edges={edges}>
      {stickyHeader}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          { paddingBottom: NAV_CLEARANCE },
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
      </ScrollView>
    </SafeAreaView>
  );

  if (!gradient) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {body}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
