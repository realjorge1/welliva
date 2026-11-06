/**
 * WelcomeBack — the one calm screen after a week or more away.
 *
 * No count of the days, no zeros, no red. One warm line, and two ways on. The
 * answers sit on the floor and the words are centred in the room above them, so
 * it holds on a short phone and doesn't float on a tall one; the words scroll if
 * a large text size needs it, and the answers never leave the glass.
 *
 * FreshStartCard is its small sibling: the Monday / 1st-of-the-month offer, as
 * an ordinary card on Home. Never a notification.
 */
import { AppText, Button, IconBadge, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { freshMomentTitle, welcomeLine, whyLead } from "@/services/smart";
import React from "react";
import { Modal, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SmartCard } from "./SmartCard";

/** What Start fresh does, said plainly in both places it is offered. */
const FRESH_EXPLAINED =
  "Start fresh eases your workouts for a week and starts Your week from today. Your history stays.";

export function WelcomeBack({
  visible,
  today,
  why,
  whyAt,
  onStartFresh,
  onPickUp,
}: {
  visible: boolean;
  today: string;
  /** Their own reason, word for word, when they gave one and it's been a while. */
  why?: string | null;
  whyAt?: string;
  onStartFresh: () => void;
  onPickUp: () => void;
}) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onPickUp}>
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md,
          },
        ]}
      >
        <ScrollView
          style={styles.words}
          contentContainerStyle={styles.wordsInner}
          showsVerticalScrollIndicator={false}
        >
          <IconBadge name="sunny-outline" tone={colors.primary} size={64} />
          <AppText variant="display" align="center" style={styles.title}>
            Welcome back.
          </AppText>
          <AppText variant="body" color="secondary" align="center" style={styles.line}>
            {welcomeLine(today)}
          </AppText>
          {why ? (
            <AppText variant="callout" align="center" style={styles.why}>
              {whyLead(whyAt)} “{why}”
            </AppText>
          ) : null}
        </ScrollView>
        <Button label="Start fresh from today" onPress={onStartFresh} />
        <Button
          label="Pick up where I left off"
          variant="tonal"
          onPress={onPickUp}
          style={styles.second}
        />
        <AppText variant="caption" color="tertiary" align="center" style={styles.note}>
          {FRESH_EXPLAINED}
        </AppText>
      </View>
    </Modal>
  );
}

export function FreshStartCard({
  kind,
  onStartFresh,
  onPickUp,
  style,
}: {
  kind: "monday" | "month";
  onStartFresh: () => void;
  onPickUp: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SmartCard
      icon="sunny-outline"
      message={freshMomentTitle(kind)}
      source={FRESH_EXPLAINED}
      primary={{ label: "Start fresh from today", onPress: onStartFresh }}
      secondary={{ label: "Pick up where I left off", onPress: onPickUp }}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.xl },
  words: { flex: 1 },
  wordsInner: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  title: { marginTop: Spacing.xl },
  line: { marginTop: Spacing.md, maxWidth: 340 },
  why: { marginTop: Spacing.xl, maxWidth: 340 },
  second: { marginTop: Spacing.sm },
  note: { marginTop: Spacing.md },
});
