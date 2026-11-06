/**
 * DrinkLog — today's drinks, newest first, each one removable.
 *
 * This is the part that makes it a LOG and not a counter. Every glass that
 * reached today's total is listed with the time it was had, and the cross beside
 * it takes that drink back out — the fix for a tap that should not have
 * happened, which a bare total could only offer as "go and edit a number you
 * cannot see the parts of".
 *
 * WATER THE LIST NEVER SAW is one honest line at the foot, "Earlier": anything in
 * the day's total that no drink explains (logged before the list existed). It has
 * no time and no cross, because there is nothing to take out — and without it the
 * rows would add up to less than the number above them.
 *
 * Three rows are shown and the rest fold behind "Show all". No animation on the
 * fold: it is a list that grew, not an event.
 */
import { AppText, Mono, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import type { DrinkRows } from "@/services/nutrition/waterPours";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { COLLAPSED_ROWS, clockLabel, drinkCount } from "./hydrationLogic";

type Item =
  | { kind: "pour"; id: string; ml: number; at: string }
  | { kind: "earlier"; ml: number };

export function DrinkLog({
  rows,
  removingId,
  onRemove,
}: {
  rows: DrinkRows;
  /** The drink being taken out right now, so its cross cannot be pressed twice. */
  removingId: string | null;
  onRemove: (id: string) => void;
}) {
  const { colors } = useColors();
  const [open, setOpen] = useState(false);

  const items = useMemo<Item[]>(
    () => [
      ...rows.pours.map((p): Item => ({ kind: "pour", id: p.id, ml: p.ml, at: p.at })),
      ...(rows.earlierMl > 0 ? [{ kind: "earlier", ml: rows.earlierMl } as Item] : []),
    ],
    [rows],
  );

  const shown = open ? items : items.slice(0, COLLAPSED_ROWS);
  const hidden = items.length - shown.length;

  return (
    <View>
      <View style={styles.head}>
        <AppText variant="footnote" weight="600" color="secondary">
          Today
        </AppText>
        {rows.pours.length > 0 ? (
          <Mono size={11} tracking={0.6} color={colors.textTertiary}>
            {drinkCount(rows.pours.length).toUpperCase()}
          </Mono>
        ) : null}
      </View>

      {items.length === 0 ? (
        <AppText variant="subhead" color="tertiary" style={styles.empty}>
          Nothing logged yet today.
        </AppText>
      ) : (
        shown.map((item, i) => {
          const clock = item.kind === "pour" ? clockLabel(item.at) : "";
          const busy = item.kind === "pour" && removingId === item.id;
          return (
            <View
              key={item.kind === "pour" ? item.id : "earlier"}
              style={[
                styles.row,
                i > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.when}>
                {item.kind === "pour" ? (
                  <Mono size={12} color={colors.textTertiary} numberOfLines={1}>
                    {clock}
                  </Mono>
                ) : (
                  <AppText variant="footnote" color="tertiary">
                    Earlier
                  </AppText>
                )}
              </View>

              <AppText variant="callout" style={styles.amount}>
                {item.ml.toLocaleString()} ml
              </AppText>

              {item.kind === "pour" ? (
                <Pressable
                  onPress={() => onRemove(item.id)}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.ml} millilitres logged at ${clock}`}
                  style={({ pressed }) => [
                    styles.remove,
                    { backgroundColor: alpha(colors.text, pressed ? 0.16 : 0.08) },
                    busy && styles.busy,
                  ]}
                >
                  <Ionicons name="close" size={15} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <View style={styles.removeSpacer} />
              )}
            </View>
          );
        })
      )}

      {items.length > COLLAPSED_ROWS ? (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={open ? "Show fewer drinks" : `Show all ${items.length} entries`}
          style={styles.toggle}
        >
          <AppText variant="footnote" weight="600" color="secondary">
            {open ? "Show fewer" : `Show all (${hidden} more)`}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const REMOVE = 28;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
    marginBottom: Spacing.xs,
  },
  empty: { paddingVertical: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 44,
  },
  when: { width: 72 },
  amount: { flex: 1, fontVariant: ["tabular-nums"] },
  remove: {
    width: REMOVE,
    height: REMOVE,
    borderRadius: REMOVE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: { opacity: 0.4 },
  removeSpacer: { width: REMOVE },
  toggle: { alignSelf: "flex-start", paddingVertical: Spacing.sm },
});
