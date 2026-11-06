/**
 * UsualCard — "Your usual breakfast? Oats with milk · coffee · about 420 kcal"
 * [Log it], with "Not my usual any more" behind the ⋯.
 *
 * Words from services/smart/usual; the answers from useUsualMoment.
 */
import { usualMessage, usualSource, type Usual } from "@/services/smart";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SmartCard } from "./SmartCard";

export function UsualCard({
  usual,
  onLog,
  onNotMine,
  style,
}: {
  usual: Usual;
  onLog: (u: Usual) => void;
  onNotMine: (u: Usual) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SmartCard
      icon="restaurant-outline"
      message={usualMessage(usual)}
      source={usualSource(usual)}
      primary={{
        label: "Log it",
        onPress: () => onLog(usual),
        accessibilityHint: "Logs the same foods and amounts as last time. You can undo it straight after.",
      }}
      onMore={() => onNotMine(usual)}
      moreLabel="Not my usual any more"
      style={style}
    />
  );
}
