/**
 * PauseCard — "Pause notifications": every reminder and coaching note, silenced
 * with one switch, and back with one switch.
 *
 * It sits above the per-kind settings and never edits them
 * (services/notifications/pause): a week away shouldn't mean turning six things
 * off and remembering to turn the same six back on. The copy says exactly that,
 * because "pause" on a screen full of switches is easy to read as "reset".
 */
import { AppText, Card, IconBadge, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, Switch, View } from "react-native";

export function PauseCard({
  paused,
  onChange,
  disabled,
}: {
  paused: boolean;
  onChange: (paused: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useColors();
  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.row}>
        <IconBadge
          name={paused ? "pause-circle" : "notifications-outline"}
          tone={paused ? colors.warning : colors.textTertiary}
          size={42}
        />
        <View style={styles.flex}>
          <AppText variant="bodyLg" weight="700">
            Pause all notifications
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.status}>
            {paused
              ? "Paused — nothing will arrive until you switch this off. Everything below stays exactly as you set it."
              : "Silence every reminder and coaching note at once, without losing any of your settings."}
          </AppText>
        </View>
        <Switch
          value={paused}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.warning, false: colors.border }}
          accessibilityLabel="Pause all notifications"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1 },
  status: { marginTop: 2, lineHeight: 17 },
});
