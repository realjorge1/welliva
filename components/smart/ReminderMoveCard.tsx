/**
 * ReminderMoveCard — "You usually tick this around 9:40 PM. Your reminder goes
 * off at 7:00 PM. Move it to 9:30 PM?"  [Move it]  [Keep 7:00 PM]
 *
 * Words from services/smart/reminderMove (`moveCopy`); the answers are the
 * screen's (useReminderMoveActions), so a move goes through the same path the
 * user's own edit would and always leaves an Undo.
 */
import { moveCopy, type MoveSuggestion } from "@/services/smart";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SmartCard } from "./SmartCard";

export function ReminderMoveCard({
  move,
  where,
  onMove,
  onKeep,
  style,
}: {
  move: MoveSuggestion;
  /** "own" on the thing's own page, "list" on the Notifications screen. */
  where: "own" | "list";
  onMove: (s: MoveSuggestion) => void;
  onKeep: (s: MoveSuggestion) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const copy = moveCopy(move, where);
  return (
    <SmartCard
      icon="time-outline"
      message={copy.message}
      source={copy.source}
      primary={{
        label: copy.moveLabel,
        onPress: () => onMove(move),
        accessibilityHint: "Changes the reminder's time. You can undo it straight after.",
      }}
      secondary={{ label: copy.keepLabel, onPress: () => onKeep(move) }}
      style={style}
    />
  );
}
