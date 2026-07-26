/**
 * HabitRow — one habit in the list: identity icon, name + streak line, a mini
 * consistency heatmap, and the completion control (check toggle for manual
 * habits; auto-tracked ones show a chevron — they complete themselves from
 * app data).
 */
import { Motion, Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { buildHeatWeeks } from "../../services/HabitService";
import { frequencyLabel } from "../../models/habit";
import type { HabitView } from "../../contexts/HabitsContext";
import { IconBadge } from "../ui/IconBadge";
import { AppText } from "../ui/Text";
import { useColors } from "../ui/useColors";
import { HabitHeatmap } from "./HabitHeatmap";

const MINI_WEEKS = 12;

export interface HabitRowProps {
  view: HabitView;
  today: string;
  onPress: () => void;
  onToggle: () => void;
}

export function HabitRow({ view, today, onPress, onToggle }: HabitRowProps) {
  const { colors } = useColors();
  const { habit, stats, done } = view;
  const weeks = buildHeatWeeks(habit, done, today, MINI_WEEKS);

  const scale = useRef(new Animated.Value(1)).current;
  const pop = () => {
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: Motion.spring.tension,
      friction: 10,
    }).start();
  };

  const streakLine = `${stats.currentStreak}-day streak  ·  ${frequencyLabel(habit.days)}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <IconBadge name={habit.icon as any} tone={habit.color} size={44} />

      <View style={styles.textCol}>
        <AppText variant="bodyLg" weight="600" numberOfLines={1}>
          {habit.name}
        </AppText>
        <AppText variant="footnote" color="secondary" numberOfLines={1}>
          {streakLine}
        </AppText>
      </View>

      <HabitHeatmap weeks={weeks} color={habit.color} cellSize={6.5} gap={2} />

      {habit.source === "manual" ? (
        <Pressable
          hitSlop={10}
          onPress={() => {
            pop();
            onToggle();
          }}
          style={styles.checkWrap}
        >
          <Animated.View
            style={[
              styles.check,
              { transform: [{ scale }] },
              stats.doneToday
                ? { backgroundColor: habit.color, borderColor: habit.color }
                : { borderColor: alpha(colors.text, 0.25) },
            ]}
          >
            {stats.doneToday && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </Animated.View>
        </Pressable>
      ) : (
        <View style={styles.checkWrap}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  checkWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
