/**
 * CycleDial — her whole cycle as an instrument: a ring of graduated strokes.
 *
 * The cycle-screen sibling of the Diet calorie dial (components/ui/TickRing).
 * Every day of the cycle is a small group of radial strokes, day 1 at the top,
 * running clockwise — so the top of the circle is also where the NEXT period
 * begins, and the faint rose climbing toward it is the window it's likely in.
 *
 *   · colour says what a day is: rose for a logged period (deep on day 1,
 *     lighter toward its end), the same rose lighter for the rest of a period
 *     and for the forecast (a prediction must never look like a record), lilac
 *     for the fertile window — drawn only when she has chosen to see it —
 *     brightening to the ovulation day;
 *   · length draws the shape: a period swells and settles, the fertile window
 *     rises to a peak on the ovulation day, ordinary days are short with a
 *     longer mark at the start of each week;
 *   · the days behind her are lit (ordinary ones in a pearl that runs blush to
 *     lilac), the days ahead are dim, and today is a needle that runs deeper
 *     than any stroke — the calorie dial's needle, in the cycle's colours;
 *   · lit period and fertile strokes carry a soft glow: the same strokes drawn
 *     three times, wider and fainter, which reads as a haze without a blur.
 *
 * Big dials add a bezel (a drop at the top where a period begins, the week
 * numbers, a small egg on the ovulation day), a thin inner line from day 1 to
 * today in a rose-to-lilac blend with a bead on today, and a faint glow behind
 * the centre. Home's small dial is strokes, glow and needle.
 *
 * MOTION. One sweep, on the UI thread: the needle travels from the top to today,
 * the strokes behind it light as it passes with a short light running just
 * behind it, the inner line draws with it and the bead rides its tip; as it
 * lands, the glow comes up. Then nothing moves. Nothing loops: a perpetual
 * animation commits a frame forever, and the low-end phones this app runs on
 * pay for that (welliva-low-end-perf).
 *
 * SVG, not Skia: the strokes are static strings and a per-frame Skia path is the
 * GPU-cache leak this app has already paid for once. The glow sits in its own
 * <Svg> under the strokes, so it fades with a plain view opacity. The inner
 * line's draw-on uses dash = its full length, so no dash is ever visible (no
 * dashed lines).
 *
 * The geometry is pure and tested: ./cycleDialLayout.
 */
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Ease } from "@/components/motion/motion";
import { useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import type { DialModel } from "@/services/cycle";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  cycleDialLayout,
  dialArc,
  dialPoint,
  dropPath,
  mixHex,
  verticalShare,
  type CycleDialLayout,
  type DialDayKind,
} from "./cycleDialLayout";
import { useCyclePalette, type CyclePalette } from "./cycleTheme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Draws nothing — a path with no segment. */
const EMPTY = "M0 0";

/** The sweep, a touch longer than a ring's fill so the light has time to travel. */
export const DIAL_SWEEP_MS = 1100;
/** The glow, three times over: [width × the stroke's, share of the strongest alpha]. */
const GLOW_STACK: readonly (readonly [number, number])[] = [
  [2.2, 1],
  [3.8, 0.5],
  [5.8, 0.25],
];
/** The light behind the needle: [from°, to°] behind the sweep's front, and its strength. */
const TRAIL: readonly (readonly [number, number, number])[] = [
  [0, 6, 0.8],
  [6, 15, 0.42],
  [15, 28, 0.18],
];
const GLOWING: readonly DialDayKind[] = ["period", "fertile", "ovulation"];

let DIAL_SEQ = 0;

export interface CycleDialProps {
  model: DialModel;
  size: number;
  /** The strokes' width. Leave out: it follows the dial's size. */
  strokeWidth?: number;
  /**
   * The bead's tint on today. Leave out: it takes the inner line's own colour
   * at that point (rose during a period, toward lilac mid-cycle).
   */
  todayTone?: string;
  /**
   * "always" draws in on every mount (the cycle screen, where it's the hero);
   * "intro" only on the app's cold-start reveal, like every Ring on Home.
   */
  animate?: "always" | "intro" | "never";
  children?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Bottom to top: the record is always drawn over a forecast. */
const DRAW_ORDER: readonly DialDayKind[] = ["plain", "predicted", "fertile", "ovulation", "periodAhead", "period"];

interface Fills {
  pearl: string;
  periodRun: string;
  fertileRun: string;
}

function strokeColor(kind: DialDayKind, lit: boolean, p: CyclePalette, f: Fills): string {
  switch (kind) {
    case "plain":
      return lit ? f.pearl : p.dial.idle;
    case "period":
      return lit ? f.periodRun : p.dial.periodAhead;
    case "periodAhead":
      return p.dial.periodAhead;
    case "predicted":
      return p.dial.predicted;
    case "fertile":
      return lit ? f.fertileRun : p.dial.fertileAhead;
    case "ovulation":
      return p.ovulation;
  }
}

function glowColor(kind: DialDayKind, p: CyclePalette): string {
  return kind === "period" ? p.period : kind === "ovulation" ? p.ovulation : p.fertile;
}

/** A gradient's direction along a run of lit strokes: from its first stroke to its last. */
function runVector(geo: CycleDialLayout, kinds: readonly DialDayKind[]) {
  const run = geo.strokes.filter((s) => s.lit && kinds.includes(s.kind));
  if (!run.length) return null;
  const a = dialPoint(geo.size, geo.outerR, run[0].deg);
  const b = dialPoint(geo.size, geo.outerR, run[run.length - 1].deg);
  return { a, b };
}

/** The lit strokes of one kind, revealed as the sweep passes each one. */
function LitLayer({
  degs,
  segs,
  color,
  width,
  progress,
  end,
}: {
  degs: number[];
  segs: string[];
  color: string;
  width: number;
  progress: SharedValue<number>;
  end: number;
}) {
  const props = useAnimatedProps(() => {
    const sweep = progress.value * end;
    let d = "";
    for (let i = 0; i < segs.length; i++) {
      if (degs[i] >= sweep) break;
      d += segs[i];
    }
    return { d: d === "" ? EMPTY : d };
  });
  return (
    <AnimatedPath
      d={EMPTY}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
      animatedProps={props}
    />
  );
}

/** One band of the light that runs behind the needle, gone once it lands. */
function TrailBand({
  degs,
  segs,
  from,
  to,
  strength,
  color,
  width,
  progress,
  end,
}: {
  degs: number[];
  segs: string[];
  from: number;
  to: number;
  strength: number;
  color: string;
  width: number;
  progress: SharedValue<number>;
  end: number;
}) {
  const props = useAnimatedProps(() => {
    const p = progress.value;
    const sweep = p * end;
    let d = "";
    for (let i = 0; i < segs.length; i++) {
      if (degs[i] >= sweep - from) break;
      if (degs[i] >= sweep - to) d += segs[i];
    }
    const fade = Math.min(1, Math.max(0, (1 - p) / 0.14));
    return { d: d === "" ? EMPTY : d, strokeOpacity: strength * fade };
  });
  return (
    <AnimatedPath
      d={EMPTY}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
      animatedProps={props}
    />
  );
}

export function CycleDial({
  model,
  size,
  strokeWidth,
  todayTone,
  animate = "always",
  children,
  accessibilityLabel,
  style,
}: CycleDialProps) {
  const { colors, isDark } = useColors();
  const palette = useCyclePalette();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const ids = useRef(`cycledial-${DIAL_SEQ++}`).current;

  const geo = useMemo(() => cycleDialLayout(model, size, strokeWidth), [model, size, strokeWidth]);
  const c = size / 2;
  const end = geo.todayDeg ?? 0;
  const fills: Fills = useMemo(
    () => ({ pearl: `url(#${ids}-pearl)`, periodRun: `url(#${ids}-period)`, fertileRun: `url(#${ids}-fertile)` }),
    [ids],
  );

  // Static: every stroke not yet reached, one path per colour.
  // Animated: every stroke behind today, one layer per kind, in sweep order.
  // Glow: the lit period and fertile strokes, whole, under everything else.
  // Trail: every lit stroke in sweep order, for the light behind the needle.
  const { dim, lit, glow, trail } = useMemo(() => {
    const dimByColor = new Map<string, string>();
    const litByKind = new Map<DialDayKind, { degs: number[]; segs: string[] }>();
    for (const kind of DRAW_ORDER) {
      for (const s of geo.strokes) {
        if (s.kind !== kind) continue;
        if (s.lit) {
          const layer = litByKind.get(kind) ?? { degs: [], segs: [] };
          layer.degs.push(s.deg);
          layer.segs.push(s.d);
          litByKind.set(kind, layer);
        } else {
          const color = strokeColor(kind, false, palette, fills);
          dimByColor.set(color, (dimByColor.get(color) ?? "") + s.d);
        }
      }
    }
    const ordered = geo.strokes.filter((s) => s.lit); // already in sweep order
    return {
      dim: [...dimByColor.entries()].map(([color, d]) => ({ color, d })),
      lit: DRAW_ORDER.filter((k) => litByKind.has(k)).map((kind) => ({
        kind,
        color: strokeColor(kind, true, palette, fills),
        ...(litByKind.get(kind) as { degs: number[]; segs: string[] }),
      })),
      glow: GLOWING.filter((k) => litByKind.has(k)).map((kind) => ({
        kind,
        color: glowColor(kind, palette),
        d: (litByKind.get(kind) as { segs: string[] }).segs.join(""),
      })),
      trail: { degs: ordered.map((s) => s.deg), segs: ordered.map((s) => s.d) },
    };
  }, [geo, palette, fills]);

  // Gradients along the period run (deep → light) and the fertile run (up to ovulation).
  const periodVec = runVector(geo, ["period"]);
  const fertileVec = runVector(geo, ["fertile", "ovulation"]);
  let ovStop = 1;
  if (fertileVec && geo.ovulationDeg !== null) {
    const o = dialPoint(size, geo.outerR, geo.ovulationDeg);
    const vx = fertileVec.b.x - fertileVec.a.x;
    const vy = fertileVec.b.y - fertileVec.a.y;
    const len2 = vx * vx + vy * vy;
    ovStop = len2 > 0 ? Math.min(1, Math.max(0, ((o.x - fertileVec.a.x) * vx + (o.y - fertileVec.a.y) * vy) / len2)) : 1;
  }

  const hasToday = geo.todayDeg !== null;
  const lineTone = hasToday ? mixHex(palette.period, palette.fertile, verticalShare(end)) : palette.fertile;
  const inPeriodFamily =
    geo.todayKind === "period" || geo.todayKind === "periodAhead" || geo.todayKind === "predicted";
  const tone = todayTone ?? (inPeriodFamily ? palette.period : lineTone);
  const trailColor = isDark ? "#FFFFFF" : lineTone;

  const still = reduced || animate === "never" || (animate === "intro" && !intro);
  const progress = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: DIAL_SWEEP_MS, easing: Ease.decelerate });
    // Sweep again when the shape of the cycle or today changes, not on every render.
  }, [still, progress, model.length, model.today, model.arcs.length]);

  // ── the glow comes up as the needle lands ────────────────────────────────
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.82, 1], [0, 1], "clamp"),
  }));

  // ── the needle rides the sweep ───────────────────────────────────────────
  const needle = geo.needle;
  const nOut = geo.outerR;
  const nIn = needle ? Math.hypot(needle.x1 - c, needle.y1 - c) : 0;
  const needleProps = useAnimatedProps(() => {
    const a = (progress.value * end * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    return {
      opacity: progress.value > 0.002 ? 1 : 0,
      x1: c + nIn * sin,
      y1: c - nIn * cos,
      x2: c + nOut * sin,
      y2: c - nOut * cos,
    };
  });

  // ── the inner line draws with it ─────────────────────────────────────────
  const innerR = geo.innerR;
  const showInner = !geo.compact && innerR > 0;
  const linePath = showInner && hasToday ? dialArc(size, innerR, 0, end) : null;
  // A hair longer than the arc, so the draw-on never leaves a visible gap.
  const lineLen = innerR * ((end * Math.PI) / 180) + 2;
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLen * (1 - progress.value),
  }));

  // ── the bead rides its tip ───────────────────────────────────────────────
  const w = geo.innerWidth;
  const halo = w * 6.8;
  const knob = w * 3.8;
  const dot = w * 1.8;
  const beadStyle = useAnimatedStyle(() => {
    const a = (progress.value * end * Math.PI) / 180;
    return {
      opacity: interpolate(progress.value, [0, 0.12], [0, 1], "clamp"),
      transform: [{ translateX: innerR * Math.sin(a) }, { translateY: -innerR * Math.cos(a) }],
    };
  });

  const bz = geo.bezelSize;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {glow.length ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width={size} height={size}>
            {glow.flatMap((g) =>
              GLOW_STACK.map(([widthBy, share]) => (
                <Path
                  key={`${g.kind}-${widthBy}`}
                  d={g.d}
                  stroke={g.color}
                  strokeOpacity={palette.dial.bloom * share}
                  strokeWidth={geo.strokeWidth * widthBy}
                  strokeLinecap="round"
                  fill="none"
                />
              )),
            )}
          </Svg>
        </Animated.View>
      ) : null}

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* In the dial's own coordinates, top to bottom — a gradient fitted
              to the lit strokes' box would re-stretch as each one lit. */}
          <LinearGradient id={`${ids}-pearl`} gradientUnits="userSpaceOnUse" x1={c} y1={0} x2={c} y2={size}>
            <Stop offset={0} stopColor={palette.dial.litTop} />
            <Stop offset={1} stopColor={palette.dial.litBottom} />
          </LinearGradient>
          <LinearGradient id={`${ids}-line`} gradientUnits="userSpaceOnUse" x1={c} y1={0} x2={c} y2={size}>
            <Stop offset={0} stopColor={palette.period} />
            <Stop offset={1} stopColor={palette.fertile} />
          </LinearGradient>
          <LinearGradient
            id={`${ids}-period`}
            gradientUnits="userSpaceOnUse"
            x1={periodVec?.a.x ?? c}
            y1={periodVec?.a.y ?? 0}
            x2={periodVec?.b.x ?? size}
            y2={periodVec?.b.y ?? c}
          >
            <Stop offset={0} stopColor={palette.dial.periodDeep} />
            <Stop offset={1} stopColor={palette.dial.periodLight} />
          </LinearGradient>
          <LinearGradient
            id={`${ids}-fertile`}
            gradientUnits="userSpaceOnUse"
            x1={fertileVec?.a.x ?? c}
            y1={fertileVec?.a.y ?? size}
            x2={fertileVec?.b.x ?? 0}
            y2={fertileVec?.b.y ?? c}
          >
            <Stop offset={0} stopColor={palette.fertile} />
            <Stop offset={ovStop} stopColor={palette.ovulation} />
            <Stop offset={1} stopColor={ovStop >= 0.999 ? palette.ovulation : palette.fertile} />
          </LinearGradient>
          {showInner ? (
            <RadialGradient id={`${ids}-glow`} gradientUnits="userSpaceOnUse" cx={c} cy={c} r={innerR}>
              <Stop offset={0} stopColor={tone} stopOpacity={palette.dial.centreGlow} />
              <Stop offset={1} stopColor={tone} stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>

        {showInner ? (
          <>
            <Circle cx={c} cy={c} r={size / 2 - 0.5} stroke={palette.dial.hairline} strokeWidth={1} fill="none" />
            <Circle cx={c} cy={c} r={innerR} fill={`url(#${ids}-glow)`} />
            <Circle cx={c} cy={c} r={innerR} stroke={palette.track} strokeWidth={w} fill="none" />
          </>
        ) : null}

        {dim.map((layer) => (
          <Path
            key={layer.color}
            d={layer.d}
            stroke={layer.color}
            strokeWidth={geo.strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {lit.map((layer) => (
          <LitLayer
            key={layer.kind}
            degs={layer.degs}
            segs={layer.segs}
            color={layer.color}
            width={geo.strokeWidth}
            progress={progress}
            end={end}
          />
        ))}
        {trail.segs.length
          ? TRAIL.map(([from, to, strength]) => (
              <TrailBand
                key={`trail-${from}`}
                degs={trail.degs}
                segs={trail.segs}
                from={from}
                to={to}
                strength={strength}
                color={trailColor}
                width={geo.strokeWidth}
                progress={progress}
                end={end}
              />
            ))
          : null}

        {linePath ? (
          <AnimatedPath
            d={linePath}
            stroke={`url(#${ids}-line)`}
            strokeWidth={w}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${lineLen} ${lineLen}`}
            animatedProps={lineProps}
          />
        ) : null}

        {needle ? (
          <AnimatedLine
            x1={c}
            y1={c}
            x2={c}
            y2={c}
            stroke={colors.text}
            strokeWidth={needle.width}
            strokeLinecap="round"
            animatedProps={needleProps}
          />
        ) : null}

        {geo.bezel.map((m) =>
          m.kind === "drop" ? (
            <Path key="drop" d={dropPath(m.x, m.y, m.deg, bz * 1.25)} fill={palette.period} />
          ) : m.kind === "egg" ? (
            <React.Fragment key="egg">
              <Circle cx={m.x} cy={m.y} r={bz * 0.42} stroke={palette.ovulation} strokeWidth={bz * 0.13} fill="none" />
              <Circle cx={m.x} cy={m.y} r={bz * 0.15} fill={palette.ovulation} />
            </React.Fragment>
          ) : (
            <SvgText
              key={`week-${m.day}`}
              x={m.x}
              y={m.y + bz * 0.36}
              fontSize={bz}
              fontWeight="600"
              fill={palette.dial.bezelInk}
              textAnchor="middle"
            >
              {String(m.day)}
            </SvgText>
          ),
        )}
      </Svg>

      {showInner && hasToday ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.bead, { left: c - halo / 2, top: c - halo / 2, width: halo, height: halo }, beadStyle]}
        >
          <View
            style={[styles.center, { width: halo, height: halo, borderRadius: halo / 2, backgroundColor: alpha(tone, 0.22) }]}
          >
            <View
              style={[styles.center, { width: knob, height: knob, borderRadius: knob / 2, backgroundColor: colors.text }]}
            >
              <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: tone }} />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {children != null ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  bead: { position: "absolute" },
});
