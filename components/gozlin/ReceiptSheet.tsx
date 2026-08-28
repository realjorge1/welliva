/**
 * ReceiptSheet — "where did this number come from?", answered.
 *
 * Opens when a figure in the coach's reply is tapped. Shows the figure, then
 * every piece of evidence that backs it: which of the coach's tools read it,
 * which field it was, and the value exactly as the log held it.
 *
 * WHY THE RAW VALUE IS SHOWN NEXT TO THE SPOKEN ONE. A coach says "0.4 kg/week"
 * for a stored 0.4083; a receipt that only repeated "0.4" would prove nothing.
 * Showing both is the whole point — it demonstrates the number was ROUNDED for
 * speech rather than invented for it, and rounding is the one liberty the
 * grounding layer grants. Hiding it would make the honest case look identical
 * to the dishonest one.
 *
 * WHAT THIS DELIBERATELY DOESN'T DO. It does not explain, interpret, or
 * reassure. It is a receipt, not a second opinion — the moment it starts
 * arguing that the number is correct, it stops being evidence and becomes more
 * coach copy, which is exactly the thing it exists to let people check.
 */

import { AppText, Sheet } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { originLabel, pathLabel, type Receipt } from "@/services/gozlin/agent";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

/** Trim float noise without hiding that the stored value had more precision. */
function formatRaw(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function ReceiptSheet({
  receipt,
  onClose,
}: {
  receipt: Receipt | null;
  onClose: () => void;
}) {
  const { colors } = useColors();

  return (
    <Sheet
      visible={receipt != null}
      onClose={onClose}
      maxHeightRatio={0.7}
      header={
        <View style={styles.header}>
          <AppText variant="caption" color="secondary" style={styles.eyebrow}>
            WHERE THIS CAME FROM
          </AppText>
          <AppText variant="title" weight="600">
            {receipt ? formatRaw(receipt.shown) : ""}
          </AppText>
        </View>
      }
    >
      {receipt ? (
        <View style={styles.body}>
          {receipt.sources.map((s, i) => {
            const spokenDiffers = formatRaw(s.value) !== formatRaw(receipt.shown);
            return (
              <View
                key={`${s.origin}|${s.path}|${i}`}
                style={[
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <AppText variant="subhead" weight="600">
                    {pathLabel(s.path)}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {originLabel(s.origin)}
                  </AppText>
                  {spokenDiffers ? (
                    <AppText variant="caption" color="secondary" style={styles.raw}>
                      Logged as {formatRaw(s.value)} · rounded for speech
                    </AppText>
                  ) : null}
                </View>
              </View>
            );
          })}

          <AppText variant="caption" color="secondary" style={styles.footnote}>
            Gozlin can only use figures its tools read from your own logs. It
            never calculates or estimates one.
          </AppText>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  eyebrow: { letterSpacing: 1 },
  body: { gap: Spacing.sm, paddingBottom: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 1 },
  raw: { marginTop: 2 },
  footnote: { marginTop: Spacing.xs, lineHeight: 17 },
});
