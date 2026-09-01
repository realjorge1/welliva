/**
 * NotificationBannerPreview — a faithful mock of a delivered Welliva reminder.
 *
 * Same app icon, same title/body shape, same action button, in the same order
 * the OS draws them. It exists because the permission prompt can be shown once
 * and a refusal is close to permanent: showing the exact thing being asked for,
 * BEFORE the system dialog, is the difference between "another app wants to
 * send me notifications" and "oh, that button logs my lunch".
 *
 * Non-interactive by design. It is a promise about what will arrive, not a
 * control — a tappable mock would be a lie about a lock screen.
 *
 * Lifted out of NotificationPrimer so the primer and the Tap-to-log screen show
 * the SAME banner. Two hand-rolled mocks of one notification would drift, and
 * the drift would land exactly where it hurts: a preview promising a button the
 * real notification does not carry.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const APP_ICON = require("@/assets/images/welliva48.png");

export interface NotificationBannerPreviewProps {
  title: string;
  body: string;
  /** The action button's text — the real button's words, not a paraphrase. */
  actionLabel: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Slide it in on mount. Off for a banner that is already on screen. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NotificationBannerPreview({
  title,
  body,
  actionLabel,
  actionIcon = "checkmark-circle-outline",
  animate = true,
  style,
}: NotificationBannerPreviewProps) {
  const { colors, isDark } = useColors();
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, enter]);

  return (
    <Animated.View
      // One element, one label: a screen reader should hear a notification,
      // not five loose fragments of one.
      accessible
      accessibilityLabel={`Example notification. ${title}. ${body}. Button: ${actionLabel}`}
      style={[
        styles.banner,
        {
          backgroundColor: isDark ? alpha("#FFFFFF", 0.09) : alpha("#0B0D10", 0.05),
          borderColor: colors.cardBorder,
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
        style,
      ]}
    >
      <View style={styles.head}>
        <Image source={APP_ICON} style={styles.icon} />
        <AppText variant="caption" color="tertiary" uppercase style={styles.app}>
          Welliva
        </AppText>
        <AppText variant="caption" color="tertiary">
          now
        </AppText>
      </View>

      <AppText variant="callout" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="footnote" color="secondary">
        {body}
      </AppText>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <View style={styles.action}>
        <Ionicons name={actionIcon} size={16} color={colors.primary} />
        <AppText variant="footnote" color="brand" style={styles.actionLabel}>
          {actionLabel}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  icon: { width: 18, height: 18, borderRadius: 4, marginRight: Spacing.sm },
  app: { flex: 1, letterSpacing: 0.6 },
  title: { fontWeight: "700", marginBottom: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.lg },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
  },
  actionLabel: { fontWeight: "700", marginLeft: Spacing.xs },
});
