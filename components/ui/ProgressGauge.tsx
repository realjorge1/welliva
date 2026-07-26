/**
 * ProgressGauge — a premium automotive-cluster tachometer for a single goal.
 *
 * A 270° dial mounted in a machined bezel: a graduated tick scale, a red
 * "redline" zone at the top of the range, a crimson gradient fill sweep with a
 * hot white filament core, a glowing needle head, numeric scale labels, an
 * ambient under-bloom and a glass highlight. The center reads the live value +
 * unit, with an odometer-style mini readout below (e.g. a streak). It renders
 * its own dark instrument face + bezel so it looks identical in light and dark
 * themes — a physical gauge embedded in the card.
 *
 * Pure react-native-svg (no Skia dependency) so it draws on every surface; only
 * the fill sweep + needle animate, driven by one Reanimated shared value.
 */
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Motion, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { AppText } from "./Text";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const START_DEG = 135; // bottom-left
const SWEEP_DEG = 270; // clockwise, 90° gap centered at the bottom
const DEG2RAD = Math.PI / 180;

/** Default crimson → hot-pink ramp, matching the reference cluster. */
export const GAUGE_CRIMSON = ["#9E0E3D", "#E51E5C", "#FF4D6D"] as const;

let GAUGE_SEQ = 0;

export interface ProgressGaugeProps {
  /** Current value (e.g. workouts this week). */
  value: number;
  /** Full-scale value (e.g. weekly target). */
  max: number;
  size?: number;
  /** Small unit under the big value (like "mph"). */
  unit?: string;
  /** Fill ramp — start (low) → end (redline). */
  gradient?: readonly [string, string, ...string[]];
  /** Odometer-style readout inside the bottom of the dial. */
  mini?: { icon: keyof typeof Ionicons.glyphMap; text: string; tone?: string };
  /** Minor ticks per whole unit. Auto-picked from `max` when omitted. */
  ticksPerUnit?: number;
  /** Fraction (0–1) where the redline zone begins. Defaults to the last unit. */
  redlineFrom?: number;
  /** Format the big center value. */
  formatValue?: (v: number) => string;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressGauge({
  value,
  max,
  size = 244,
  unit,
  gradient = GAUGE_CRIMSON,
  mini,
  ticksPerUnit,
  redlineFrom,
  formatValue,
  duration = Motion.duration.hero,
  style,
}: ProgressGaugeProps) {
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const safeMax = max > 0 ? max : 1;
  const fill = Math.max(0, Math.min(1, value / safeMax));
  const id = useRef(`gauge-${GAUGE_SEQ++}`).current;

  // ── Geometry ──
  const cx = size / 2;
  const cy = size / 2;
  const bezelW = size * 0.032;
  const faceR = size / 2 - bezelW - size * 0.004;
  const outerR = faceR - size * 0.014;
  const minorLen = size * 0.028;
  const majorLen = size * 0.052;
  const bandW = size * 0.052;
  const rBand = outerR - majorLen - size * 0.018 - bandW / 2;
  const rLabel = rBand - bandW / 2 - size * 0.058;
  const arcLen = rBand * SWEEP_DEG * DEG2RAD;

  const point = (r: number, deg: number) => {
    const a = deg * DEG2RAD;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const arcBetween = (r: number, d0: number, d1: number) => {
    const p0 = point(r, d0);
    const p1 = point(r, d1);
    const large = d1 - d0 > 180 ? 1 : 0;
    return `M${p0.x} ${p0.y} A${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };

  const trackPath = useMemo(
    () => arcBetween(rBand, START_DEG, START_DEG + SWEEP_DEG),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size],
  );

  const redFrom = redlineFrom ?? (safeMax > 1 ? (safeMax - 1) / safeMax : 0.8);
  const redlinePath = useMemo(
    () => arcBetween(rBand, START_DEG + SWEEP_DEG * redFrom, START_DEG + SWEEP_DEG),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, redFrom],
  );

  // ── Tick scale ──
  const tpu = ticksPerUnit ?? (safeMax <= 6 ? 5 : safeMax <= 12 ? 3 : 2);
  const ticks = useMemo(() => {
    const total = Math.max(1, Math.round(safeMax * tpu));
    const out: {
      x1: number; y1: number; x2: number; y2: number; major: boolean; red: boolean;
    }[] = [];
    for (let i = 0; i <= total; i++) {
      const frac = i / total;
      const deg = START_DEG + SWEEP_DEG * frac;
      const major = i % tpu === 0;
      const inner = point(outerR - (major ? majorLen : minorLen), deg);
      const outer = point(outerR, deg);
      out.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major, red: frac >= redFrom - 1e-6 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, safeMax, tpu, redFrom]);

  // ── Numeric labels ──
  const labels = useMemo(() => {
    const step = safeMax <= 8 ? 1 : Math.ceil(safeMax / 6);
    const out: { x: number; y: number; text: string }[] = [];
    for (let g = 0; g <= safeMax + 1e-6; g += step) {
      const frac = g / safeMax;
      const pos = point(rLabel, START_DEG + SWEEP_DEG * frac);
      out.push({ x: pos.x, y: pos.y, text: String(Math.round(g)) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, safeMax]);

  // ── Animated sweep ── (sweep up from zero only on a cold-start reveal)
  const anim = useSharedValue(reduced || !intro ? fill : 0);
  useEffect(() => {
    if (reduced) {
      anim.value = fill;
      return;
    }
    anim.value = withTiming(fill, { duration, easing: Ease.standard });
  }, [fill, duration, reduced, anim]);

  const sweepProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - anim.value),
  }));
  const needleProps = useAnimatedProps(() => {
    const a = (START_DEG + SWEEP_DEG * anim.value) * DEG2RAD;
    return { cx: cx + rBand * Math.cos(a), cy: cy + rBand * Math.sin(a) };
  });

  const c0 = gradient[0];
  const cMid = gradient[Math.floor(gradient.length / 2)] ?? gradient[0];
  const cHot = gradient[gradient.length - 1];
  const bigSize = size * 0.25;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}-bloom`} cx="50%" cy="50%" r="52%">
            <Stop offset="0%" stopColor={alpha(cHot, 0.28)} />
            <Stop offset="60%" stopColor={alpha(cHot, 0.06)} />
            <Stop offset="100%" stopColor="transparent" />
          </RadialGradient>
          <SvgGradient id={`${id}-bezel`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3A333F" />
            <Stop offset="48%" stopColor="#191520" />
            <Stop offset="100%" stopColor="#05040A" />
          </SvgGradient>
          <RadialGradient id={`${id}-face`} cx="50%" cy="40%" r="72%">
            <Stop offset="0%" stopColor="#1B1322" />
            <Stop offset="60%" stopColor="#0D0913" />
            <Stop offset="100%" stopColor="#050308" />
          </RadialGradient>
          <SvgGradient id={`${id}-fill`} x1="14%" y1="90%" x2="86%" y2="12%">
            <Stop offset="0%" stopColor={c0} />
            <Stop offset="52%" stopColor={cMid} />
            <Stop offset="100%" stopColor={cHot} />
          </SvgGradient>
          <SvgGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </SvgGradient>
        </Defs>

        {/* Ambient crimson under-bloom */}
        <Circle cx={cx} cy={cy} r={size / 2} fill={`url(#${id}-bloom)`} />

        {/* Machined bezel + instrument face */}
        <Circle cx={cx} cy={cy} r={size / 2 - bezelW / 2} stroke={`url(#${id}-bezel)`} strokeWidth={bezelW} fill="none" />
        <Circle cx={cx} cy={cy} r={faceR} fill={`url(#${id}-face)`} />
        <Circle cx={cx} cy={cy} r={faceR} stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={rBand - bandW} stroke="rgba(255,255,255,0.04)" strokeWidth={1} fill="none" />

        {/* Redline zone — the goal band reads hot even before you reach it */}
        <Path d={redlinePath} stroke={alpha(cHot, 0.34)} strokeWidth={bandW} strokeLinecap="butt" fill="none" />

        {/* Graduation ticks */}
        <G>
          {ticks.map((t, i) => (
            <Line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.red ? "rgba(255,86,110,0.85)" : "rgba(255,255,255,0.18)"}
              strokeWidth={t.major ? size * 0.016 : size * 0.008}
              strokeLinecap="round"
            />
          ))}
        </G>

        {/* Numeric scale labels */}
        {labels.map((l, i) => (
          <SvgText
            key={i}
            x={l.x}
            y={l.y + size * 0.018}
            fontSize={size * 0.05}
            fontWeight="600"
            fill="rgba(255,255,255,0.46)"
            textAnchor="middle"
          >
            {l.text}
          </SvgText>
        ))}

        {/* Dim track band */}
        <Path d={trackPath} stroke="rgba(255,255,255,0.05)" strokeWidth={bandW} strokeLinecap="round" fill="none" />

        {/* Soft glow underlay */}
        <AnimatedPath
          d={trackPath}
          stroke={cHot}
          strokeWidth={bandW * 2.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.18}
          strokeDasharray={arcLen}
          animatedProps={sweepProps}
        />

        {/* Crimson fill sweep */}
        <AnimatedPath
          d={trackPath}
          stroke={`url(#${id}-fill)`}
          strokeWidth={bandW}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLen}
          animatedProps={sweepProps}
        />

        {/* Hot white filament riding the center of the fill */}
        <AnimatedPath
          d={trackPath}
          stroke="#FFE3EA"
          strokeWidth={bandW * 0.26}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
          strokeDasharray={arcLen}
          animatedProps={sweepProps}
        />

        {/* Leading needle head */}
        {fill > 0.012 && (
          <G opacity={fill < 0.999 ? 1 : 0.9}>
            <AnimatedCircle animatedProps={needleProps} r={bandW * 1.05} fill={cHot} opacity={0.3} />
            <AnimatedCircle animatedProps={needleProps} r={bandW * 0.6} fill={cHot} />
            <AnimatedCircle animatedProps={needleProps} r={bandW * 0.34} fill="#FFFFFF" />
          </G>
        )}

        {/* Glass highlight across the upper dial */}
        <Path
          d={arcBetween(faceR * 0.82, 202, 338)}
          stroke={`url(#${id}-glass)`}
          strokeWidth={size * 0.07}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      {/* Center readout */}
      <View style={styles.center} pointerEvents="none">
        <AppText
          style={[
            styles.big,
            {
              fontSize: bigSize,
              lineHeight: bigSize * 1.02,
              textShadowColor: alpha(cHot, 0.55),
              textShadowRadius: size * 0.045,
            },
          ]}
        >
          {formatValue ? formatValue(value) : String(value)}
        </AppText>
        {!!unit && (
          <AppText variant="caption" uppercase style={styles.unit}>
            {unit}
          </AppText>
        )}
      </View>

      {/* Odometer-style mini readout */}
      {mini && (
        <View style={[styles.mini, { bottom: size * 0.13 }]} pointerEvents="none">
          <View style={styles.miniPill}>
            <Ionicons name={mini.icon} size={size * 0.052} color={mini.tone ?? "#FF6B81"} />
            <AppText style={[styles.miniText, { fontSize: size * 0.05 }]}>{mini.text}</AppText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  big: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  unit: {
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
    letterSpacing: 1.6,
  },
  mini: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  miniText: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },
});
