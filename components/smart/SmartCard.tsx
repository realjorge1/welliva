/**
 * SmartCard — how every smart moment looks: one sentence, where it came from,
 * and one or two answers.
 *
 * Deliberately plain. These are offers, not alerts: no tint wash, no motion, no
 * badge. The source line is not optional decoration — every claim the app makes
 * about someone says what it was read from ("From 12 ticks in the last 3
 * weeks"), because a suggestion with no visible basis reads as a guess.
 *
 * The answers sit in a WRAPPING row: side by side when they fit, stacked when a
 * large text size makes them not, so neither is ever squeezed to nothing.
 */
import { Button, Card, IconBadge, useColors } from "@/components/ui";
import { AppText } from "@/components/ui/Text";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Roughly how wide a 14pt bold character is, and a small Button's side padding. */
const LABEL_CHAR_WIDTH = 8.2;
const BUTTON_CHROME = 36;
/** AppText's cap on system font scaling for this size of text. */
const MAX_LABEL_SCALE = 1.35;

/**
 * How much room a label needs, as a flex basis. A wrapping row breaks on the
 * basis, so two answers share a line only when both really fit at this phone's
 * text size — otherwise each takes the whole line. A fixed basis would squeeze
 * "Keep 10:30 PM" into two lines inside a one-line button.
 */
function labelBasis(label: string, fontScale: number): number {
  return Math.ceil(label.length * LABEL_CHAR_WIDTH * Math.min(fontScale, MAX_LABEL_SCALE)) + BUTTON_CHROME;
}

export interface SmartAction {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}

export interface SmartCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** The icon's hue. Defaults to the brand. */
  tone?: string;
  /** The one sentence. */
  message: string;
  /** Where it came from — always stated. */
  source: string;
  primary: SmartAction;
  secondary?: SmartAction;
  /** A quiet third answer, as a text link ("Not now"). */
  tertiary?: SmartAction;
  /** A ⋯ for the rarer answer ("Not my usual any more"). */
  onMore?: () => void;
  moreLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function SmartCard({
  icon,
  tone,
  message,
  source,
  primary,
  secondary,
  tertiary,
  onMore,
  moreLabel = "More options",
  style,
}: SmartCardProps) {
  const { colors } = useColors();
  const { fontScale } = useWindowDimensions();
  return (
    <Card padding="lg" style={style}>
      <View style={styles.head}>
        <IconBadge name={icon as never} tone={tone ?? colors.primary} size={34} />
        <View style={styles.text}>
          <AppText variant="callout">{message}</AppText>
          <AppText variant="caption" color="tertiary" style={styles.source}>
            {source}
          </AppText>
        </View>
        {onMore && (
          <Pressable
            onPress={onMore}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={moreLabel}
            style={styles.more}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
      <View style={styles.actions}>
        <Button
          label={primary.label}
          onPress={primary.onPress}
          accessibilityHint={primary.accessibilityHint}
          size="sm"
          fullWidth={false}
          style={[styles.action, { flexBasis: labelBasis(primary.label, fontScale) }]}
        />
        {secondary && (
          <Button
            label={secondary.label}
            onPress={secondary.onPress}
            accessibilityHint={secondary.accessibilityHint}
            variant="tonal"
            size="sm"
            fullWidth={false}
            style={[styles.action, { flexBasis: labelBasis(secondary.label, fontScale) }]}
          />
        )}
      </View>
      {tertiary && (
        <Pressable
          onPress={tertiary.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tertiary.label}
          style={styles.tertiary}
        >
          <AppText variant="footnote" weight="600" color="secondary" align="center">
            {tertiary.label}
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  text: { flex: 1 },
  source: { marginTop: Spacing.xs },
  more: { paddingTop: 2 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  // Grows into what's left of the line; the basis comes from its label. A label
  // wider than the whole card takes the line and stops at its edge.
  action: { flexGrow: 1, flexShrink: 1, maxWidth: "100%" },
  tertiary: { alignSelf: "center", marginTop: Spacing.md, paddingVertical: 2 },
});
