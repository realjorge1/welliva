/**
 * EmptyState — the screen a person actually sees on day one.
 *
 * Welliva had empty states before this, but each screen wrote its own: some had
 * an icon, some didn't; some explained, some just said "No habits yet"; and
 * NONE of them offered the next tap. That last part is the real defect. An
 * empty state without an action is a dead end wearing a friendly face — the
 * user is told there is nothing here and left to work out where "here" gets
 * filled from.
 *
 * THE RULE THIS COMPONENT ENFORCES. Three parts, in this order:
 *
 *   1. WHAT this screen will hold — not "nothing yet", which describes the
 *      absence rather than the thing.
 *   2. WHY it's worth filling — one sentence, concrete, no marketing.
 *   3. THE NEXT TAP — an action that fills it, whenever one exists.
 *
 * The action is optional only because a few surfaces genuinely fill themselves
 * from elsewhere (the log fills as you tick meals). Those pass `hint` instead,
 * which says where the filling happens. A screen that offers neither is a bug
 * in the copy, not in this component.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. Day one is the only session where a user
 * has no sunk cost and no reason to return. Every retention curve in this
 * category is decided in the first ten minutes, and this is what those minutes
 * are made of.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Spacing } from "@/constants/theme";
import { AppText } from "./Text";
import { Button } from "./Button";
import { Card } from "./Card";
import { IconBadge } from "./IconBadge";
import { useColors } from "./useColors";

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * What this screen holds when it isn't empty — "Your food log", not
   * "Nothing yet". Naming the thing tells someone what they're being offered;
   * naming the absence tells them only that they're missing out.
   */
  title: string;
  /** One concrete sentence on why filling it is worth the effort. */
  body: string;
  /** The tap that fills it. Omit only when the screen fills from elsewhere. */
  action?: { label: string; onPress: () => void };
  /** Where the filling happens, for screens with no action of their own. */
  hint?: string;
  /** Dial the icon down where several empties stack in one scroll. */
  tone?: "normal" | "quiet";
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  hint,
  tone = "normal",
  style,
}: EmptyStateProps) {
  const { colors } = useColors();

  return (
    <Card padding="xxl" style={[styles.card, style]}>
      <IconBadge
        name={icon}
        tone={tone === "quiet" ? colors.textTertiary : colors.primary}
        size={52}
      />
      <AppText variant="headline" align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="subhead" color="secondary" align="center" style={styles.body}>
        {body}
      </AppText>

      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          fullWidth
          style={styles.action}
        />
      ) : null}

      {!action && hint ? (
        <View style={styles.hintRow}>
          <Ionicons name="arrow-down" size={13} color={colors.textTertiary} />
          <AppText variant="caption" color="tertiary" align="center">
            {hint}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center" },
  title: { marginTop: Spacing.md },
  body: { marginTop: Spacing.xs, maxWidth: 320 },
  action: { marginTop: Spacing.lg, alignSelf: "stretch" },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: Spacing.md,
  },
});
