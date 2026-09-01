/**
 * MeterGlyph — what a meter shows when a filled bar would be a lie.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 * A progress meter says "here is how much of the thing you have done". On a
 * rest day there is no thing: the plan asks for nothing, so nothing is owed and
 * nothing was skipped. Home's workout tile handled that by scoring the day 1.0
 * and drawing a completely full bar — five lit segments that, read at a glance,
 * say "you trained hard today" on a day you deliberately did not train. Same on
 * the fitness page: a recovery bar pinned at 100 is five bars of nothing.
 *
 * A meter at either extreme for a reason that has nothing to do with progress
 * is not a meter, and dressing it up as one is the kind of small dishonesty
 * that makes people stop believing the other numbers.
 *
 * ── THE ANSWER ──────────────────────────────────────────────────────────────
 * Say what is actually true, in the same footprint and the same colour: a
 * resting face where the day is a rest day, a flexed arm where the body is
 * fully recovered and ready. Both occupy exactly the box the bars would have
 * occupied, so the layout does not move when the state changes — the tile just
 * stops claiming a number it does not have.
 *
 * ── WHY THEY ARE DRAWN, NOT PICKED ──────────────────────────────────────────
 * Ionicons has neither a sleeping face nor a flexed arm, and a real emoji would
 * drag its own multi-colour palette into a tile that is tinted by its tone.
 * These are geometric pictograms — circles and round-capped strokes — in the
 * same flat-pictogram language as the workout demo figure, so they inherit the
 * tint like everything else on the card and stay legible at 26 points.
 */
import React from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type MeterGlyphName = "rest" | "flex";

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
  // Both glyphs are authored in a 24×24 square and centred in the meter's box,
  // so a wide, short meter shows a correctly-proportioned glyph the height of
  // its tallest bar rather than a stretched one.
  return (
    <View
      style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? (name === "rest" ? "Rest day" : "Ready to train")}
    >
      <Svg width={height} height={height} viewBox="0 0 24 24">
        {name === "rest" ? <RestingFace tone={tone} /> : <FlexedArm tone={tone} />}
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

/**
 * A flexed arm, built from primitives rather than a traced silhouette.
 *
 * FOUR SHAPES AND EVERY ONE OF THEM IS DIAGONAL, which is the whole trick. The
 * obvious construction — a horizontal upper arm, a vertical forearm, a round
 * fist on top — was drawn and thrown away twice: axis-aligned bars read as
 * furniture, and a circle balanced on a vertical stem reads as a head on a
 * neck. The silhouette came out as a small seated figure, every time.
 *
 * Tilting the limb so it rises to the elbow and folds back up-and-LEFT fixes
 * both at once. The fist no longer sits over the elbow, so there is no stem for
 * a head to sit on, and the two diagonals meeting at a point read immediately
 * as a joint. The gap between the bicep and the inner forearm is the elbow
 * crook, and it is the single feature doing most of the work — it is why this
 * still parses at 26 points, where a traced bicep outline is mush.
 */
function FlexedArm({ tone }: { tone: string }) {
  return (
    <G>
      {/* upper arm — shoulder, rising to the elbow */}
      <Path
        d="M3.4 20 L16.4 16.4"
        stroke={tone}
        strokeWidth={3.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* forearm — folded back up and inward from the elbow */}
      <Path
        d="M16.4 16.4 L11.4 6.4"
        stroke={tone}
        strokeWidth={3.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* the bicep, tilted along the upper arm so it bulges off the top edge
          rather than sitting on it like a ball */}
      <G rotation={-16} origin="9.6, 16">
        <Ellipse cx={9.6} cy={16} rx={5} ry={3.6} fill={tone} />
      </G>
      {/* fist — clear of the elbow, which is what stops the whole thing
          reading as a head on shoulders */}
      <Circle cx={10.2} cy={4} r={3.3} fill={tone} />
    </G>
  );
}
