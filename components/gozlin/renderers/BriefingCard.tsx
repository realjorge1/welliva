/**
 * BriefingCard — the Daily AI Briefing (Phase 4).
 *
 * Gozlin's sit-down, rendered ABOVE the coach's own sentence (see
 * ../GozlinMessageBubble): the journey masthead, Yesterday Summary, Today's
 * Plan (workout + nutrition focus), Risk Alerts, Suggested Adjustments, the
 * Gozlin Insight (motivation), and the single next move.
 *
 * NOTHING HERE IS DECORATIVE OR FIXED. Every line is composed by
 * services/gozlin/GozlinBriefingEngine from the user's own logs — the day
 * count off their journey start, yesterday's rows off the diet and workout
 * history, the risks off the prioritized insights. A day with nothing recorded
 * renders a shorter card, not a fuller one with invented content.
 *
 * ── THE MASTHEAD ────────────────────────────────────────────────────────────
 *
 * The card used to open with a small tinted "Day 12" pill and the journey name
 * in body text beside it — correct, and completely unremarkable. It now opens
 * as an instrument panel: the day set as a zero-padded readout in the mono face
 * (components/ui/Mono), the journey named in a tracked technical label, and a
 * seven-segment rail showing where in the current journey week today falls.
 *
 * THE RAIL COUNTS EXACTLY WHAT IT SAYS. Seven segments, one per day of the
 * current week of the journey, filled up to and including today, with today's
 * segment brightest. `WEEK n` is `ceil(dayCount / 7)`. It is derived, not
 * decorative — the standing rule in this app is that anything which looks like
 * a counter must be one.
 */

import { AppText, Card, Mono } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing, type ThemeColors } from "@/constants/theme";
import type { BriefingLine, GozlinBriefing } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import AILogoIcon from "../AILogoIcon";
import { CardHeader, LeverBox, MonoLabel, Readout, toneColor } from "./GozlinCardKit";

type IconName = keyof typeof Ionicons.glyphMap;

/** Days in a journey week. The rail's whole vocabulary. */
const WEEK = 7;

/**
 * Zero-pad the day counter to three digits.
 *
 * It is a readout, and a readout that changes width as it counts is a readout
 * that shoves its neighbours around. "008" also quietly says there will be a
 * "108" one day, which is the exact promise this card is making.
 */
function padDay(n: number): string {
  return String(Math.max(0, n)).padStart(3, "0");
}

export function BriefingCard({ data }: { data: GozlinBriefing }) {
  const { colors } = useColors();

  const day = data.dayCount;
  // Position inside the current journey week, 1…7. Null when there is no
  // journey start yet — a brand-new account gets the label and no rail rather
  // than a rail of guesses.
  const dayOfWeek = day != null && day > 0 ? ((day - 1) % WEEK) + 1 : null;
  const weekNo = day != null && day > 0 ? Math.ceil(day / WEEK) : null;
  const tint = toneColor(colors, data.tone);

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.lg }}>
        {/* ── The masthead ── */}
        <View style={styles.masthead}>
          <View style={styles.mastheadTop}>
            <View
              style={[
                styles.mark,
                { backgroundColor: alpha(tint, 0.12), borderColor: alpha(tint, 0.28) },
              ]}
            >
              <AILogoIcon size={16} color={tint} />
            </View>

            <View style={styles.mastheadText}>
              <View style={styles.dayRow}>
                <MonoLabel text="Day" color={alpha(colors.text, 0.45)} size={9} />
                <Readout value={day != null ? padDay(day) : "—"} color={tint} size={22} />
              </View>
              <MonoLabel
                text={data.journeyLabel}
                color={colors.textSecondary}
                size={9}
              />
            </View>

            {weekNo != null ? (
              <View
                style={[styles.weekPill, { borderColor: alpha(colors.text, 0.12) }]}
              >
                <MonoLabel text={`Week ${weekNo}`} color={colors.textSecondary} size={9} />
              </View>
            ) : null}
          </View>

          {dayOfWeek != null ? (
            <View style={styles.rail} accessibilityRole="progressbar"
              accessibilityLabel={`Day ${dayOfWeek} of week ${weekNo}`}>
              {Array.from({ length: WEEK }, (_, i) => {
                const n = i + 1;
                const done = n < dayOfWeek;
                const today = n === dayOfWeek;
                return (
                  <View
                    key={n}
                    style={[
                      styles.railSeg,
                      today && styles.railSegToday,
                      {
                        backgroundColor: today
                          ? tint
                          : done
                            ? alpha(tint, 0.42)
                            : alpha(colors.text, 0.08),
                      },
                    ]}
                  />
                );
              })}
              <Mono size={9} weight="700" color={colors.textTertiary} tracking={0.8} style={styles.railCount}>
                {`${dayOfWeek}/${WEEK}`}
              </Mono>
            </View>
          ) : null}
        </View>

        {/* ── Yesterday ── */}
        {data.yesterday.length > 0 ? (
          <Section title="Yesterday" icon="time-outline" colors={colors}>
            {data.yesterday.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Today's plan ── */}
        <Section title={`Today · ${data.todayFocus}`} icon="today-outline" colors={colors}>
          <LineRow line={data.workoutFocus} colors={colors} />
          <LineRow line={data.nutritionFocus} colors={colors} />
        </Section>

        {/* ── Risk alerts ── */}
        {data.riskAlerts.length > 0 ? (
          <Section title="Heads up" icon="alert-circle-outline" colors={colors} tint={colors.warning}>
            {data.riskAlerts.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Suggested adjustments ── */}
        {data.adjustments.length > 0 ? (
          <Section title="Suggested adjustments" icon="options-outline" colors={colors}>
            {data.adjustments.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Gozlin Insight (motivation) ── */}
        <View style={[styles.insight, { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.2) }]}>
          <View style={styles.insightHead}>
            <AILogoIcon size={14} color={colors.primary} />
            <MonoLabel text="Gozlin insight" color={colors.primary} />
          </View>
          <AppText variant="callout" style={{ lineHeight: 21 }}>
            {data.motivation}
          </AppText>
        </View>

        {/* ── The one move ── */}
        <LeverBox label="Your one move" text={data.microAction} color={colors.primary} />
      </View>
    </Card>
  );
}

function Section({
  title,
  icon,
  colors,
  tint,
  children,
}: {
  title: string;
  icon: string;
  colors: ThemeColors;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <CardHeader icon={icon} label={title} color={tint ?? colors.primary} />
      <View style={{ gap: Spacing.sm }}>{children}</View>
    </View>
  );
}

function LineRow({ line, colors }: { line: BriefingLine; colors: ThemeColors }) {
  const tint = toneColor(colors, line.tone);
  return (
    <View style={styles.lineRow}>
      <View style={[styles.lineIcon, { backgroundColor: alpha(tint, 0.14) }]}>
        <Ionicons name={line.icon as IconName} size={14} color={tint} />
      </View>
      <AppText variant="subhead" color="secondary" style={{ flex: 1, lineHeight: 19 }}>
        {line.text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: { gap: Spacing.sm },
  mastheadTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  /** The coach's own mark, framed — the card is signed before it speaks. */
  mark: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mastheadText: { flex: 1, gap: 1 },
  /** Baseline-aligned so the small "DAY" sits on the counter's feet. */
  dayRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  weekPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  /** Seven days of the current journey week, filled to today. */
  rail: { flexDirection: "row", alignItems: "center", gap: 3 },
  railSeg: { flex: 1, height: 3, borderRadius: 2 },
  /** Today reads as a marker, not just a brighter segment. */
  railSegToday: { height: 5, borderRadius: 3 },
  railCount: { marginLeft: Spacing.xs },

  lineRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  lineIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  insight: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  insightHead: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
});
