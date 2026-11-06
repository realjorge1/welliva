/**
 * CheckInBar — one pill that opens the "how are you feeling" check-in.
 *
 * It is the same check-in the gold + opens from anywhere (the same sheet, the
 * same write — `useQuickLog().saveCheckin`), so an entry made here and one made
 * from the quick-log sheet land in one place and count together.
 *
 * THE STATUS ON THE RIGHT IS A COUNT, NOT A MOOD. "2 moods today" is what the
 * store holds for today — momentary entries and the daily one together, the same
 * number the quick-log row's caption shows. It never says "synced" or "done":
 * a check-in is something you can add to as often as you like. It names MOOD
 * on purpose: "not logged today" beside a day of logged meals read as the app
 * saying the day itself was not logged (owner, 2026-10-31).
 */
import { MindSheet } from "@/components/mind";
import { useQuickLog } from "@/components/gozlin";
import { AppText, Mono, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { EDGE_WHITE, HOME_ORANGE, INSTRUMENT_BLACK, ON_ORANGE } from "./surface";

const PLUS = 40;

export const CheckInBar = React.memo(function CheckInBar({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const quickLog = useQuickLog();
  const [open, setOpen] = useState(false);

  const count = quickLog.todayCount;
  const status =
    count > 0 ? `${count} ${count === 1 ? "MOOD" : "MOODS"} TODAY` : "NO MOOD LOGGED YET";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          count > 0
            ? `Check in. ${count} ${count === 1 ? "mood" : "moods"} logged today`
            : "Check in. No mood logged today yet"
        }
        accessibilityHint="Opens how you feel"
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: INSTRUMENT_BLACK, borderColor: EDGE_WHITE },
          pressed && styles.pressed,
          style,
        ]}
      >
        <View style={styles.plus}>
          <Ionicons name="add" size={22} color={ON_ORANGE} />
        </View>

        <AppText variant="callout" weight="700" numberOfLines={1} style={styles.label}>
          Check in
        </AppText>

        <View style={styles.status}>
          <View
            style={[
              styles.dot,
              { backgroundColor: count > 0 ? colors.success : colors.textTertiary },
            ]}
          />
          <Mono
            size={11}
            tracking={0.6}
            color={colors.textTertiary}
            numberOfLines={1}
            style={styles.statusText}
          >
            {status}
          </Mono>
        </View>
      </Pressable>

      <MindSheet
        visible={open}
        existing={quickLog.todayCheckin}
        onClose={() => setOpen(false)}
        onSave={quickLog.saveCheckin}
      />
    </>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: PLUS + Spacing.md,
    paddingLeft: 6,
    paddingRight: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  plus: {
    width: PLUS,
    height: PLUS,
    borderRadius: PLUS / 2,
    backgroundColor: HOME_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flexShrink: 0 },
  status: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    minWidth: 0,
  },
  statusText: { flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
