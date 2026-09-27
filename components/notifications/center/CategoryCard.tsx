/**
 * CategoryCard — one kind of lock-screen reminder: what it asks, the button it
 * carries, whether it's on, and a way to TRY it.
 *
 * "Try it" sends the real banner for that kind — same category, same button —
 * a few seconds later, so the user can lock the phone and press it. The press
 * is answered with a confirmation and writes nothing (services/notifications/
 * pipeline). People trust a button they have pressed.
 */
import { AppText, Card, IconBadge, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { sendTestNotification, type TestKind } from "@/services/notifications/send";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from "react-native";

export interface CategoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  /** One line: the current state, stated plainly. */
  status: string;
  /** The button this kind of reminder carries, word for word. */
  buttonLabel: string;
  /** Master switch; omit for a card with no switch of its own (habits). */
  enabled?: boolean;
  onToggle?: (on: boolean) => void;
  disabled?: boolean;
  /** Which demo "Try it" sends; omit to hide it. */
  tryKind?: TestKind;
  children?: React.ReactNode;
}

export function CategoryCard({
  icon,
  tone,
  title,
  status,
  buttonLabel,
  enabled,
  onToggle,
  disabled,
  tryKind,
  children,
}: CategoryCardProps) {
  const { colors } = useColors();
  const on = enabled ?? true;

  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.head}>
        <IconBadge name={icon} tone={on ? tone : colors.textTertiary} size={42} />
        <View style={styles.flex}>
          <AppText variant="bodyLg" weight="700">
            {title}
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.status}>
            {status}
          </AppText>
        </View>
        {onToggle ? (
          <Switch
            value={!!enabled}
            onValueChange={onToggle}
            disabled={disabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={`${title} reminders`}
          />
        ) : null}
      </View>

      {/* The button the notification carries, word for word — the promise,
          shown as the thing itself. */}
      <View style={styles.buttonRow}>
        <View
          accessible
          accessibilityLabel={`Lock-screen button: ${buttonLabel}`}
          style={[
            styles.buttonChip,
            { backgroundColor: alpha(tone, 0.1), borderColor: alpha(tone, 0.25) },
          ]}
        >
          <Ionicons name="lock-closed" size={11} color={tone} />
          <AppText
            variant="caption"
            color={tone}
            weight="700"
            numberOfLines={1}
            style={styles.buttonText}
          >
            {buttonLabel}
          </AppText>
        </View>
        <View style={styles.flex} />
        {tryKind ? <TryIt kind={tryKind} tone={tone} disabled={disabled} /> : null}
      </View>

      {children ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

function TryIt({ kind, tone, disabled }: { kind: TestKind; tone: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPress = async () => {
    if (state !== "idle") return;
    setState("sending");
    const result = await sendTestNotification(kind);
    if (!result.ok) {
      setState("idle");
      Alert.alert(
        result.reason === "denied" ? "Notifications are off" : "Not available here",
        result.reason === "denied"
          ? "Turn on notifications for welliva in your device settings to try this."
          : "Notifications need the full app build — they don't run in Expo Go or on web.",
      );
      return;
    }
    setState("sent");
    timer.current = setTimeout(() => setState("idle"), (result.delaySeconds + 4) * 1000);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || state === "sending"}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Send a test notification"
      accessibilityHint="Arrives in a few seconds. Lock your phone and press its button."
      style={({ pressed }) => [styles.try, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      {state === "sending" ? (
        <ActivityIndicator size="small" color={tone} />
      ) : (
        <>
          <Ionicons
            name={state === "sent" ? "checkmark-circle" : "paper-plane-outline"}
            size={14}
            color={tone}
          />
          <AppText variant="caption" color={tone} weight="700">
            {state === "sent" ? "Lock your phone" : "Try it"}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1 },
  status: { marginTop: 2, lineHeight: 17 },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  buttonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
  },
  buttonText: { letterSpacing: 0.2, flexShrink: 1 },
  try: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingLeft: Spacing.sm,
  },
  body: { marginTop: Spacing.md },
});
