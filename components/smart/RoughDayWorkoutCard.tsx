/**
 * RoughDayWorkoutCard — what the Fitness tab offers on a rough day, in place of
 * the workout: a gentle walk or full rest, and the person picks.
 *
 * Nothing here logs anything. A walk the app didn't watch has no duration it
 * could honestly record, and a workout entry would count toward training load
 * and achievements, so the walk is a suggestion and rest is simply the plan.
 * For someone who wants something in the app, the seven-minute Mobility Reset
 * is one tap away; for someone who feels up to it after all, so is the workout.
 */
import { AppText, Button, Card, IconBadge, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <AppText variant="footnote" color="brand" weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

export function RoughDayWorkoutCard({
  choice,
  hasSession,
  onChoose,
  onMobility,
  onTrainAnyway,
  style,
}: {
  /** What they already picked today, if anything. */
  choice?: "walk" | "rest";
  /** A workout is planned today, so "anyway" means something. */
  hasSession: boolean;
  onChoose: (choice: "walk" | "rest") => void;
  onMobility: () => void;
  onTrainAnyway: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();

  const head =
    choice === "walk"
      ? { icon: "walk-outline", title: "A gentle walk", body: "Ten to twenty minutes, at a pace you could chat at. No tracking, no target." }
      : choice === "rest"
        ? { icon: "bed-outline", title: "Resting today", body: "Rest is the plan today. Your workouts pick up again tomorrow." }
        : { icon: "leaf-outline", title: "Take it easy today", body: "Your plan can wait. What sounds right?" };

  return (
    <Card padding="xxl" style={style}>
      <View style={styles.head}>
        <IconBadge name={head.icon as never} tone={colors.success} size={48} />
        <View style={styles.flex}>
          <AppText variant="headline">{head.title}</AppText>
          <AppText variant="subhead" color="secondary">
            {head.body}
          </AppText>
        </View>
      </View>

      {!choice && (
        <>
          <Button label="A gentle walk" icon="walk-outline" onPress={() => onChoose("walk")} style={styles.first} />
          <Button
            label="Rest today"
            icon="bed-outline"
            variant="tonal"
            onPress={() => onChoose("rest")}
            style={styles.second}
          />
        </>
      )}

      <View style={styles.links}>
        {choice === "walk" && <QuietLink label="Or seven minutes of Mobility Reset, indoors" onPress={onMobility} />}
        {choice === "walk" && <QuietLink label="Rest instead" onPress={() => onChoose("rest")} />}
        {choice === "rest" && <QuietLink label="A gentle walk instead" onPress={() => onChoose("walk")} />}
        {hasSession && <QuietLink label="Do today's workout anyway" onPress={onTrainAnyway} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  first: { marginTop: Spacing.xl },
  second: { marginTop: Spacing.sm },
  links: { marginTop: Spacing.md, gap: Spacing.sm },
  link: { alignSelf: "flex-start", paddingVertical: 2 },
  pressed: { opacity: 0.6 },
});
