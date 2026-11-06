/**
 * THE HUNGRIER WEEK — the offer, and what the plan is doing today.
 *
 *   HungryOfferCard  "You usually eat about 250 kcal more... Want me to plan for it?"
 *   HungryPlanCard   on a day the plan moved her target: what it did, and the way out
 *
 * Every word and number is services/cycle/hungry's. It is always an offer: never
 * on by default, "No thanks" is final, and the off switch is on this card as well
 * as in cycle settings.
 */
import { SmartCard } from "@/components/smart/SmartCard";
import { AppText } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import { hungryTodayLine, type HungryOffer } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

export function HungryOfferCard({ offer, style }: { offer: HungryOffer; style?: StyleProp<ViewStyle> }) {
  const palette = useCyclePalette();
  const cycle = useCycle();
  return (
    <SmartCard
      icon="restaurant-outline"
      tone={palette.period}
      message={offer.text}
      source={`${offer.detail} ${offer.window}`}
      primary={{
        label: "Plan for it",
        onPress: () => void cycle.setHungryPlan(true),
        accessibilityHint: "Moves a little of your calorie target onto those days. Turn it off any time.",
      }}
      secondary={{ label: "No thanks", onPress: () => void cycle.declineHungryPlan() }}
      style={style}
    />
  );
}

export function HungryPlanCard({ kcal, style }: { kcal: number; style?: StyleProp<ViewStyle> }) {
  const palette = useCyclePalette();
  const cycle = useCycle();
  const line = hungryTodayLine(kcal);
  if (!line) return null;
  return (
    <View style={[styles.card, { backgroundColor: palette.wash }, style]}>
      <View style={styles.row}>
        <Ionicons name="restaurant-outline" size={16} color={palette.period} style={styles.icon} />
        <AppText variant="subhead" style={styles.flex}>
          {line}
        </AppText>
      </View>
      <Pressable
        onPress={() => void cycle.setHungryPlan(false)}
        accessibilityRole="button"
        accessibilityLabel="Turn off the hungrier-week plan"
        hitSlop={8}
        style={styles.link}
      >
        <AppText variant="footnote" color="brand" weight="700">
          Turn this off
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  icon: { marginTop: 2 },
  flex: { flex: 1 },
  link: { alignSelf: "flex-start", marginTop: Spacing.md, paddingVertical: 2 },
});
