/**
 * ListRow — the app's standard row inside a card list (settings, pickers, any
 * "list of things you can tap" surface).
 *
 * One row, four slots: a tinted leading badge, the text column (title +
 * subtitle + an optional footer for the one line that only matters when the row
 * is active), a right slot for a control/value, and the chevron. Rows that
 * aren't tappable stay plain text so a screen reader doesn't announce them as
 * buttons, and the whole row reads as ONE element rather than three fragments.
 *
 * Pair with `ListGroup`, which supplies the card and the inset hairlines — a row
 * should never have to know whether it is first, last, or next to a divider.
 */
import { Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { IconBadge } from "./IconBadge";
import { AppText } from "./Text";
import { useColors } from "./useColors";

/** Badge edge length. Fixed so every row's text column starts on the same line. */
const BADGE = 40;

/**
 * Left gutter of the TEXT column — row padding + badge + gap. Exported so
 * `ListGroup` can inset its dividers to start exactly under the title, which is
 * the detail that makes a stack of rows read as one list instead of a pile of
 * boxes.
 */
export const ROW_TEXT_INSET = Spacing.lg + BADGE + Spacing.md;

export interface ListRowProps {
  /** Leading badge glyph. Omit (or pass `leading`) for a row with no badge. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Badge hue. Defaults to the brand color; ignored when `destructive`. */
  tone?: string;
  /** Custom leading node — takes precedence over `icon`. */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /**
   * An extra line under the subtitle. Use it for context that only applies in
   * the row's current state (the consequence of a selected option, a warning) —
   * not as a third subtitle.
   */
  footer?: React.ReactNode;
  /** Right-aligned value text, rendered before `right`/the chevron. */
  value?: string;
  /** Control or status node on the trailing edge (Pill, Stepper, spinner…). */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Force the chevron on/off. Defaults to on for a tappable row with no `right`. */
  chevron?: boolean;
  /** Paints the badge and title in the error color — for destructive actions. */
  destructive?: boolean;
  disabled?: boolean;
  /** Overrides the composed "title. subtitle" spoken name. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Announced state, e.g. `{ selected: true }` for a row acting as a radio. */
  accessibilityState?: React.ComponentProps<typeof Pressable>["accessibilityState"];
  accessibilityRole?: React.ComponentProps<typeof Pressable>["accessibilityRole"];
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  icon,
  tone,
  leading,
  title,
  subtitle,
  footer,
  value,
  right,
  onPress,
  chevron,
  destructive = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityRole,
  style,
}: ListRowProps) {
  const { colors } = useColors();
  const hue = destructive ? colors.error : tone ?? colors.primary;
  const showChevron = chevron ?? (!!onPress && !right);

  const body = (
    <>
      {leading ??
        (icon ? <IconBadge name={icon} tone={hue} size={BADGE} /> : null)}
      <View style={styles.text}>
        <AppText variant="callout" color={destructive ? colors.error : "primary"}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="tertiary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
        {footer}
      </View>
      {value ? (
        <AppText variant="callout" color="secondary">
          {value}
        </AppText>
      ) : null}
      {right}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, disabled && styles.disabled, style]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={
        accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={({ pressed }) => [
        styles.row,
        // A wash rather than an opacity drop: the row tints under the finger
        // while its text stays at full contrast. ListGroup clips it to the
        // card's corners.
        pressed && { backgroundColor: alpha(colors.text, 0.05) },
        disabled && styles.disabled,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 60,
  },
  text: { flex: 1 },
  subtitle: { marginTop: 2 },
  disabled: { opacity: 0.45 },
});
