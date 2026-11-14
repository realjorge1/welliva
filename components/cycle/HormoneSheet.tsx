/**
 * HormoneSheet — "What's at work today", opened from its line in the cycle
 * screen's Today section or from the phase name under the dial.
 *
 * The words are services/cycle/hormones (pure, tested). This draws them, and
 * a small picture: typical shapes stretched to her cycle, a solid line for
 * today, a dot for her estimated ovulation (only with the fertile window on).
 *
 * The picture is STATIC SVG: drawn once, no animation loop (the low-end
 * phones this app runs on pay for every frame), no dashes anywhere, and only
 * as wide as the sheet — far below the width at which Android's SVG bitmap
 * comes up blank.
 */
import { AppText, Button, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import {
  HORMONE_LABEL,
  PICTURE_CAPTION,
  PICTURE_SAMPLES,
  type Hormone,
  type HormoneCard,
  type HormonePicture,
} from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useCyclePalette } from "./cycleTheme";

const PICTURE_HEIGHT = 112;
const PAD = 8;

export function HormoneSheet({
  card,
  visible,
  onClose,
}: {
  card: HormoneCard | null;
  visible: boolean;
  onClose: () => void;
}) {
  const palette = useCyclePalette();
  // Hold the last card so the words don't blank while the sheet slides away.
  const last = React.useRef<HormoneCard | null>(null);
  if (card) last.current = card;
  const c = card ?? last.current;

  return (
    <Sheet
      visible={visible && !!c}
      onClose={onClose}
      maxHeightRatio={0.88}
      header={
        <View style={styles.header}>
          <AppText variant="caption" color="tertiary" uppercase>
            What&apos;s at work today
          </AppText>
          <AppText variant="title">{c?.title ?? ""}</AppText>
        </View>
      }
    >
      {c ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          {c.body.map((para) => (
            <AppText key={para} variant="body" color="secondary" style={styles.para}>
              {para}
            </AppText>
          ))}

          {c.howLong ? (
            <View style={styles.block}>
              <AppText variant="caption" color="tertiary" uppercase style={styles.label}>
                How long
              </AppText>
              <AppText variant="body">{c.howLong}</AppText>
            </View>
          ) : null}

          {[c.testLine, c.symptomLine].filter(Boolean).map((line) => (
            <View key={line as string} style={[styles.note, { backgroundColor: palette.wash }]}>
              <Ionicons name="sparkles-outline" size={14} color={palette.period} />
              <AppText variant="footnote" style={styles.flex}>
                {line}
              </AppText>
            </View>
          ))}

          {c.caveat ? (
            <AppText variant="footnote" color="secondary" style={styles.block}>
              {c.caveat}
            </AppText>
          ) : null}

          {c.sure ? (
            <AppText variant="footnote" color="tertiary" style={styles.sure}>
              {c.sure}
            </AppText>
          ) : null}

          {c.picture ? <Picture picture={c.picture} /> : null}

          <Button label="Done" variant="tonal" onPress={onClose} fullWidth style={styles.done} />
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

function useHormoneColors(): Record<Hormone, string> {
  const { colors } = useColors();
  const palette = useCyclePalette();
  return useMemo(
    () => ({
      oestrogen: palette.period,
      progesterone: colors.gold,
      lh: palette.fertile,
      fsh: colors.water,
    }),
    [palette.period, palette.fertile, colors.gold, colors.water],
  );
}

function Picture({ picture }: { picture: HormonePicture }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const tone = useHormoneColors();
  const [width, setWidth] = useState(0);
  const h = PICTURE_HEIGHT;

  const paths = useMemo(() => {
    if (!width) return [];
    return picture.curves.map((curve) => {
      let d = "";
      curve.points.forEach((v, i) => {
        const x = (i / (PICTURE_SAMPLES - 1)) * width;
        const y = h - PAD - v * (h - 2 * PAD);
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      });
      return { id: curve.id, d };
    });
  }, [picture, width, h]);

  const xOf = (day: number) => ((day - 0.5) / picture.length) * width;
  const todayX = xOf(picture.today);

  return (
    <View style={styles.picture}>
      <View
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        style={[styles.canvas, { height: h, backgroundColor: alpha(colors.text, 0.04) }]}
        accessible
        accessibilityLabel="A picture of the usual hormone shapes across your cycle, with today marked. Typical shapes, not measured."
      >
        {width ? (
          <Svg width={width} height={h}>
            {paths.map((p) => (
              <Path key={p.id} d={p.d} stroke={tone[p.id]} strokeWidth={2} fill="none" strokeLinejoin="round" />
            ))}
            <Line x1={todayX} x2={todayX} y1={PAD / 2} y2={h - PAD / 2} stroke={colors.text} strokeOpacity={0.55} strokeWidth={1.5} />
            <Circle cx={todayX} cy={PAD / 2 + 2} r={3.5} fill={colors.text} />
            {picture.ovulationDay !== null ? (
              <Circle cx={xOf(picture.ovulationDay)} cy={h - PAD / 2 - 1} r={3.5} fill={palette.ovulation} />
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.legend}>
        {picture.curves.map((curve) => (
          <View key={curve.id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: tone[curve.id] }]} />
            <AppText variant="caption" color="secondary">
              {HORMONE_LABEL[curve.id]}
            </AppText>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.todaySwatch, { backgroundColor: colors.text }]} />
          <AppText variant="caption" color="secondary">
            Today
          </AppText>
        </View>
        {picture.ovulationDay !== null ? (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: palette.ovulation }]} />
            <AppText variant="caption" color="secondary">
              Ovulation (estimate)
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" color="tertiary" style={styles.caption}>
        {PICTURE_CAPTION}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 2 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  flex: { flex: 1 },
  para: { marginBottom: Spacing.sm },
  block: { marginTop: Spacing.md },
  label: { marginBottom: 2 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  sure: { marginTop: Spacing.md },
  picture: { marginTop: Spacing.lg },
  canvas: { borderRadius: Radius.lg, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  todaySwatch: { width: 2, height: 12, borderRadius: 1, opacity: 0.55 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  caption: { marginTop: Spacing.xs },
  done: { marginTop: Spacing.xl },
});
