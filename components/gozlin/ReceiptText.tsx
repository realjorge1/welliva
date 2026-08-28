/**
 * ReceiptText — the coach's reply, with every backed figure tappable.
 *
 * This is the visible half of services/gozlin/agent/receipts.ts. The coach is
 * forbidden from computing figures, grounding enforces that every number came
 * from real evidence, and the ledger records which evidence. All that was
 * already true and completely invisible; this renders it.
 *
 * WHY UNDERLINE RATHER THAN A CHIP OR A COLOUR. A figure is part of a sentence,
 * not a widget in it. Boxing every number turns a warm two-line reply into a
 * form, and colouring them competes with the tone system that already uses
 * colour to mean something (alert / gentle). A dotted underline is the
 * long-established "there is more behind this word" affordance, it survives
 * both themes, and it degrades to plain text when a message has no receipts.
 *
 * ONLY BACKED FIGURES ARE TAPPABLE. A number with no source stays plain. That
 * asymmetry is deliberate and load-bearing: the underline is a claim that
 * evidence exists, so it must never appear where it doesn't. Grounding should
 * have caught an unbacked figure and regenerated, but if one ever reaches here,
 * the correct behaviour is to show it without a promise we can't keep.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import type { Receipt } from "@/services/gozlin/agent";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

/** A run of the reply: either plain prose or a figure with evidence behind it. */
type Segment =
  | { kind: "text"; text: string }
  | { kind: "figure"; text: string; receipt: Receipt };

/**
 * Split the reply into segments, matching each numeric literal against the
 * receipts computed for this message.
 *
 * Matching is on the PARSED value rather than the literal string, because the
 * coach writes "1,840" and the ledger holds 1840. Commas inside a number are
 * stripped for the comparison and preserved in what's displayed.
 */
export function segmentReply(content: string, receipts: Receipt[]): Segment[] {
  if (receipts.length === 0) return [{ kind: "text", text: content }];

  const byValue = new Map<number, Receipt>();
  for (const r of receipts) byValue.set(r.shown, r);

  const out: Segment[] = [];
  let cursor = 0;
  // Numbers with optional thousands separators and decimals.
  const re = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

  for (const m of content.matchAll(re)) {
    const literal = m[0];
    const value = Number(literal.replace(/,/g, ""));
    const receipt = byValue.get(value);
    if (!receipt) continue;

    const start = m.index ?? 0;
    if (start > cursor) {
      out.push({ kind: "text", text: content.slice(cursor, start) });
    }
    out.push({ kind: "figure", text: literal, receipt });
    cursor = start + literal.length;
  }

  if (cursor < content.length) {
    out.push({ kind: "text", text: content.slice(cursor) });
  }
  return out;
}

export function ReceiptText({
  content,
  receipts,
  onOpenReceipt,
}: {
  content: string;
  receipts?: Receipt[];
  onOpenReceipt: (receipt: Receipt) => void;
}) {
  const { colors } = useColors();
  const segments = useMemo(
    () => segmentReply(content, receipts ?? []),
    [content, receipts],
  );

  if (segments.length === 1 && segments[0].kind === "text") {
    return <AppText variant="body">{content}</AppText>;
  }

  return (
    <AppText variant="body">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <AppText key={i} variant="body">
            {seg.text}
          </AppText>
        ) : (
          <AppText
            key={i}
            variant="body"
            weight="600"
            onPress={() => onOpenReceipt(seg.receipt)}
            accessibilityRole="button"
            accessibilityLabel={`${seg.text} — show where this number came from`}
            accessibilityHint="Opens the logs behind this figure"
            style={{
              color: colors.primary,
              textDecorationLine: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: colors.primary,
            }}
          >
            {seg.text}
          </AppText>
        ),
      )}
    </AppText>
  );
}

/**
 * The one-line hint under a reply that carries receipts, shown once per
 * message. Without it the underline is a mystery: people do not tap text they
 * have no reason to believe is tappable.
 */
export function ReceiptHint({ count }: { count: number }) {
  const { colors } = useColors();
  if (count === 0) return null;
  return (
    <View style={styles.hintRow}>
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <AppText variant="caption" color="secondary">
        {count === 1
          ? "Tap the figure to see where it came from"
          : "Tap any figure to see where it came from"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, opacity: 0.7 },
});
