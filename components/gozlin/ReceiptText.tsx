/**
 * ReceiptText — the coach's reply, and the evidence UNDER it.
 *
 * This is the visible half of services/gozlin/agent/receipts.ts. The coach is
 * forbidden from computing figures, grounding enforces that every number came
 * from real evidence, and the ledger records which evidence. This renders the
 * reply, and then renders that ledger as a trail beneath it.
 *
 * ── WHY THE NUMBERS ARE PLAIN ───────────────────────────────────────────────
 *
 * They used to be underlined and tinted in-line: every figure in every reply
 * came out brand-coloured with a dotted rule under it. The reasoning was sound
 * — the affordance sits on the thing it is about — and the result was wrong.
 * A coach's two-line answer would arrive with four coloured, underlined words
 * in it, and a sentence with four links in it is not a sentence any more, it is
 * a search result. It also read as a hyperlink, which set up an expectation of
 * navigation the sheet does not meet, and on a message that happened to mention
 * a date, a set count and a weight it turned the reply into a ransom note.
 *
 * So the prose is now prose. Not one character of a reply is styled.
 *
 * ── AND WHY THE EVIDENCE DIDN'T JUST DISAPPEAR WITH IT ──────────────────────
 *
 * Leaving the numbers tappable but invisible would have been the worst of both:
 * a promise nobody can see, discovered only by accident. Deleting receipts
 * outright would give up the single most defensible thing this coach does —
 * every figure it says can be traced to a row in the user's own logs.
 *
 * The trail is the third option. One quiet row beneath the reply, one pill per
 * backed figure, each showing the number itself and opening its receipt. The
 * claim is made once, where it can be read as a footnote instead of as
 * decoration, and the sentence above it is left alone.
 *
 * ONLY BACKED FIGURES APPEAR. A number the ledger does not know stays where it
 * is, in the prose, unmentioned. The trail is a claim that evidence exists, so
 * it must never list something we cannot open.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Mono } from "@/components/ui/Mono";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { Receipt } from "@/services/gozlin/agent";
import { Ionicons } from "@expo/vector-icons";
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
 *
 * NOTHING RENDERS THESE SEGMENTS ANY MORE — the reply is drawn as one plain
 * string. This is kept because it is still the honest answer to "which figures
 * in this sentence are backed, and in what order do they appear", which is
 * exactly what the trail below the reply has to know: the pills are ordered by
 * where their figure occurs in the prose, and they show the literal the coach
 * actually wrote rather than the ledger's stored value.
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

/**
 * The backed figures of a reply, in the order they are spoken, de-duplicated.
 *
 * A coach that says "1,840" twice in one answer has one receipt, not two — the
 * trail is a list of claims, and the same claim made twice is still one claim.
 */
export function figureTrail(
  content: string,
  receipts?: Receipt[],
): { literal: string; receipt: Receipt }[] {
  if (!receipts?.length) return [];
  const seen = new Set<number>();
  const out: { literal: string; receipt: Receipt }[] = [];
  for (const seg of segmentReply(content, receipts)) {
    if (seg.kind !== "figure") continue;
    if (seen.has(seg.receipt.shown)) continue;
    seen.add(seg.receipt.shown);
    out.push({ literal: seg.text, receipt: seg.receipt });
  }
  return out;
}

/** The reply. Plain text, always — see the header note. */
export function ReceiptText({ content }: { content: string }) {
  return <AppText variant="body">{content}</AppText>;
}

/**
 * The evidence trail: one pill per backed figure, beneath the reply.
 *
 * THE FIGURE IS THE LABEL. "1,840" opens the receipt for 1,840 — there is no
 * guessing which pill belongs to which number, because the pill IS the number.
 * They are set in the same telemetry face the coach's cards use for readouts,
 * which is what keeps them reading as instrument marks rather than as tags.
 */
export function ReceiptTrail({
  content,
  receipts,
  onOpenReceipt,
}: {
  content: string;
  receipts?: Receipt[];
  onOpenReceipt: (receipt: Receipt) => void;
}) {
  const { colors } = useColors();
  const trail = useMemo(() => figureTrail(content, receipts), [content, receipts]);
  if (trail.length === 0) return null;

  return (
    <View style={styles.trail}>
      <Ionicons name="receipt-outline" size={12} color={colors.textTertiary} />
      <AppText variant="caption" color="tertiary" style={styles.trailLabel}>
        FROM YOUR LOGS
      </AppText>
      {trail.map(({ literal, receipt }) => (
        <Pressable
          key={`${receipt.shown}`}
          onPress={() => onOpenReceipt(receipt)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${literal} — show where this number came from`}
          accessibilityHint="Opens the logs behind this figure"
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: alpha(colors.primary, pressed ? 0.2 : 0.1),
              borderColor: alpha(colors.primary, 0.24),
            },
          ]}
        >
          <Mono size={11} weight="700" color={colors.primary}>
            {literal}
          </Mono>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Wraps, because a reply with five backed figures must not push a pill off
   * the edge of a bubble that has already sized itself to the prose.
   */
  trail: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: Spacing.sm,
  },
  trailLabel: { letterSpacing: 0.8, marginRight: 1 },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
