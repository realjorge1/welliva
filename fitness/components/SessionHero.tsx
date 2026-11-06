/**
 * SessionHero — the stage of the workout player.
 *
 * A room, not a dial: the figure demonstrates on a floor, and nothing is
 * written on the stage — the clock is in the card under it, so the body is
 * never behind a number. The floor keeps the time instead. Its panels are
 * lights: a set switches them off as its box runs down, closing in on the
 * athlete from the sides; a rest switches them back on; the launch's 3-2-1
 * lights them a third at a time and GO floods them. The wall carries the phase
 * as a wash of light — gold while you work, orange when the box runs hot,
 * water-blue while you rest — the glow-along-the-foot Home's cards wear, so
 * the player belongs to the app it is in.
 *
 * It is a frame with slots. The player decides what stands on the floor (the
 * figure, the sleeping face, the flame), how much of the floor is lit and in
 * what colour, and what sits over the stage (the paused controls); this
 * measures the room and places them. Nothing in it loops: the panels change at
 * most once a second, the light crossfades only when its colour changes, and
 * the floor's lines are drawn once per size — the figure is the only thing that
 * moves continuously, as it should be.
 */
import { useColors } from "@/components/ui";
import { EDGE_WHITE, INSTRUMENT_BLACK } from "@/components/home/surface";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Reanimated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { floorGrid, floorSteps, litFloor, stageOf, type Stage } from "./sessionScene";

export type { Stage } from "./sessionScene";

export interface HeroFloor {
  /** How much of the floor is lit, 0–1: what the phase has left, or has given back. */
  lit: number;
  /** The panels' light. */
  color: string;
  /** Brighter: the launch's GO, and the whole floor at the finish. */
  flood?: boolean;
}

export interface SessionHeroProps {
  /** The wash of light up the wall behind the figure. None: the stage is still dark. */
  glow?: string;
  /** The floor's light panels — the stage's clock. */
  floor?: HeroFloor;
  /** Dim the stage under the paused controls. */
  veil?: boolean;
  /** What stands on the floor, given the measured stage. */
  renderFigure: (stage: Stage) => React.ReactNode;
  /** The small second panel, given the measured stage. */
  renderAux?: (stage: Stage) => React.ReactNode;
  auxSide?: "left" | "right";
  /** Above everything — the paused controls. */
  overlay?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** The wall's wash: nothing where it starts, strongest where the wall meets the floor. */
const WASH_AT = [0, 0.55, 1] as const;
/** The panels' light at the wall and at the card's foot — and the flood, brighter. */
const LIT = [0.24, 0.5] as const;
const FLOOD = [0.5, 0.78] as const;

export function SessionHero({
  glow,
  floor,
  veil = false,
  renderFigure,
  renderAux,
  auxSide = "right",
  overlay,
  style,
}: SessionHeroProps) {
  const { colors } = useColors();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  };

  const stage = useMemo(() => (box ? stageOf(box.w, box.h) : null), [box]);
  const grid = useMemo(() => (stage ? floorGrid(stage) : ""), [stage]);
  const steps = useMemo(() => (stage ? floorSteps(stage) : []), [stage]);
  const lit = floor ? litFloor(steps, floor.lit) : "";
  const shade = floor?.flood ? FLOOD : LIT;

  return (
    <View style={[styles.card, style]} onLayout={onLayout}>
      {stage ? (
        <>
          {/* The wash up the wall. Keyed by colour, so a phase change
              crossfades it instead of snapping. */}
          {glow ? (
            <Reanimated.View
              key={glow}
              entering={FadeIn.duration(480)}
              exiting={FadeOut.duration(480)}
              pointerEvents="none"
              style={[styles.wash, washBox(stage)]}
            >
              <LinearGradient
                colors={[alpha(glow, 0), alpha(glow, 0.08), alpha(glow, 0.26)]}
                locations={WASH_AT}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Reanimated.View>
          ) : null}

          {/* The lit panels. Keyed by colour and by the flood, so those
              crossfade; the panels themselves switch on and off like lamps. */}
          {floor ? (
            <Reanimated.View
              key={`${floor.color}-${floor.flood ? "flood" : "lit"}`}
              entering={FadeIn.duration(floor.flood ? 140 : 420)}
              exiting={FadeOut.duration(520)}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              <Svg width={stage.width} height={stage.height}>
                <Defs>
                  <SvgGradient
                    id="session-lit"
                    x1="0"
                    y1={stage.floorY}
                    x2="0"
                    y2={stage.height}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor={floor.color} stopOpacity={shade[0]} />
                    <Stop offset="1" stopColor={floor.color} stopOpacity={shade[1]} />
                  </SvgGradient>
                </Defs>
                {lit ? <Path d={lit} fill="url(#session-lit)" /> : null}
              </Svg>
            </Reanimated.View>
          ) : null}

          {grid ? (
            <Svg
              width={stage.width}
              height={stage.height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                {/* Faint at the wall, a touch brighter at the front edge. */}
                <SvgGradient
                  id="session-floor"
                  x1="0"
                  y1={stage.floorY}
                  x2="0"
                  y2={stage.height}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.05} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.16} />
                </SvgGradient>
              </Defs>
              <Path d={grid} stroke="url(#session-floor)" strokeWidth={1} fill="none" />
            </Svg>
          ) : null}

          <View style={styles.floorSlot} pointerEvents="none">
            {renderFigure(stage)}
          </View>

          {renderAux ? (
            <View
              style={[styles.aux, auxSide === "left" ? styles.auxLeft : styles.auxRight]}
              pointerEvents="none"
            >
              {renderAux(stage)}
            </View>
          ) : null}

          {veil ? (
            <Reanimated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(180)}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.background, 0.58) }]}
            />
          ) : null}

          {overlay ? <View style={[StyleSheet.absoluteFill, styles.overlay]}>{overlay}</View> : null}
        </>
      ) : null}
    </View>
  );
}

/** The wash's band: from part-way up the wall down to the floor line, where it is brightest. */
function washBox(stage: Stage): ViewStyle {
  const depth = stage.height - stage.floorY;
  const span = Math.min(stage.floorY * 0.62, depth * 2.2);
  return { top: stage.floorY - span, height: span };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    overflow: "hidden",
  },
  wash: { position: "absolute", left: 0, right: 0 },
  floorSlot: { ...StyleSheet.absoluteFillObject },
  aux: { position: "absolute", top: Spacing.md, alignItems: "center" },
  auxLeft: { left: Spacing.md },
  auxRight: { right: Spacing.md },
  overlay: { alignItems: "center", justifyContent: "center" },
});
