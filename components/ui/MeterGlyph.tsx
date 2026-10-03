/**
 * MeterGlyph — what a meter shows when a filled bar would be a lie.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 * A progress meter says "here is how much of the thing you have done". On a
 * rest day there is no thing: the plan asks for nothing, so nothing is owed and
 * nothing was skipped. Home's workout tile handled that by scoring the day 1.0
 * and drawing a completely full bar — five lit segments that, read at a glance,
 * say "you trained hard today" on a day you deliberately did not train.
 *
 * A meter at either extreme for a reason that has nothing to do with progress
 * is not a meter, and dressing it up as one is the kind of small dishonesty
 * that makes people stop believing the other numbers.
 *
 * ── THE ANSWER ──────────────────────────────────────────────────────────────
 * Say what is actually true, in the same footprint and the same colour: a
 * resting face where the day is a rest day. It occupies exactly the box the
 * bars would have occupied, so the layout does not move when the state changes
 * — the tile just stops claiming a number it does not have.
 *
 * (The fitness page's recovery card used this for a full battery at 100. It
 * shows a battery at every level now, so it has its own gauge: ./BatteryGauge.)
 *
 * ── WHY IT IS DRAWN, NOT PICKED ─────────────────────────────────────────────
 * A real emoji would drag its own multi-colour palette into a tile that is
 * tinted by its tone, and Ionicons has no sleeping face. This one is drawn in
 * circles and round-capped strokes, so it inherits the tint like everything
 * else on the card and stays legible at 26 points.
 */
import React from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type MeterGlyphName = "rest";

export interface MeterGlyphProps {
  name: MeterGlyphName;
  /** The box the meter would have filled. The glyph centres inside it. */
  width: number;
  height: number;
  tone: string;
  style?: StyleProp<ViewStyle>;
  /** Announced instead of the meter's own value. */
  label?: string;
}

export function MeterGlyph({
  name,
  width,
  height,
  tone,
  style,
  label,
}: MeterGlyphProps) {
  // Authored in a 24×24 square and centred in the meter's box, so a wide,
  // short meter shows a correctly-proportioned glyph the height of its tallest
  // bar rather than a stretched one.
  const size = Math.min(width, height);
  return (
    <View
      style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? "Rest day"}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {name === "rest" && <RestingFace tone={tone} />}
      </Svg>
    </View>
  );
}

/**
 * A sleeping face: closed eyes, a small round mouth, and a pair of z's.
 *
 * The eyes are arcs bowing DOWNWARD. An upward bow reads as a smile with no
 * eyes at all, which is the difference between "asleep" and "unsettling".
 */
function RestingFace({ tone }: { tone: string }) {
  return (
    <G>
      <Circle
        cx={11}
        cy={13.6}
        r={8.6}
        stroke={tone}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M6.6 12.1 q1.6 2.1 3.2 0"
        stroke={tone}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12.2 12.1 q1.6 2.1 3.2 0"
        stroke={tone}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={11} cy={17.4} rx={1.7} ry={2} fill={tone} />
      {/* The z's sit clear of the head, top-right, largest last — the direction
          a sleeping-face emoji reads in. */}
      <Path
        d="M16.4 1.2 h3.6 l-3.6 4 h3.6"
        stroke={tone}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );
}
