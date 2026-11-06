/**
 * DotNumeral — a whole number drawn as an LED dot matrix.
 *
 * For the figure that is READ OFF something: the grams on a macro card. Lit dots
 * carry the digits and a faint ghost of every unlit cell sits behind them, so it
 * reads as a display with fixed cells rather than as dotted type. The unit and
 * the target stay in the app's regular face, beside it — a dot matrix is for the
 * number, never for words.
 *
 * The one exception is the few words a DISPLAY says — GO, DONE, a lead "+" on an
 * overtime count — which the workout player's board shows: pass a string and
 * whatever has a glyph is drawn (see dotMatrix.glyphsOf).
 *
 * Each layer is ONE <Path> however many digits there are, and it draws once per
 * value: no per-frame work, which matters on the phones this app is tuned for.
 *
 *   <DotNumeral value={350} maxWidth={92} />
 *
 * `maxWidth` shrinks the dots (never the card) until the figure fits.
 */
import { alpha } from "@/constants/theme";
import React, { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { digitsOf, dotLayout, dotsPath, fitPitch, glyphsOf } from "./dotMatrix";
import { useColors } from "./useColors";

export interface DotNumeralProps {
  /** A number (drawn whole, never negative), or a display word / signed figure. */
  value: number | string;
  /** Centre-to-centre distance between dots at full size, in points. */
  pitch?: number;
  /** The widest the figure may be; the pitch shrinks to fit it. */
  maxWidth?: number;
  /** Lit dots. Defaults to the theme's text colour. */
  color?: string;
  /** Unlit cells. Defaults to a very faint wash of `color`. */
  ghostColor?: string;
  /** Draw the unlit cells at all. Off for a figure that is itself a backdrop. */
  cells?: boolean;
  /**
   * Lamp size against the standard fill, for a figure drawn very large: at a
   * 20pt pitch full-size lamps stop reading as a display and start reading as
   * polka dots. 1 is the standard.
   */
  dotScale?: number;
  /** Spoken name. Defaults to the digits themselves. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function DotNumeral({
  value,
  pitch = 5,
  maxWidth,
  color,
  ghostColor,
  cells = true,
  dotScale = 1,
  accessibilityLabel,
  style,
}: DotNumeralProps) {
  const { colors } = useColors();
  const lit = color ?? colors.text;
  const ghost = ghostColor ?? alpha(lit.startsWith("#") ? lit : colors.text, 0.06);

  const digits = typeof value === "number" ? digitsOf(value) : glyphsOf(value);
  const size = maxWidth != null ? fitPitch(digits.length, maxWidth, pitch) : pitch;

  const shape = useMemo(() => {
    const layout = dotLayout(digits, size);
    return {
      width: layout.width,
      height: layout.height,
      lit: dotsPath(layout.lit, layout.radius * dotScale),
      ghost: cells ? dotsPath(layout.ghost, layout.ghostRadius * dotScale) : "",
    };
  }, [digits, size, cells, dotScale]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? digits}
      style={[{ width: shape.width, height: shape.height }, style]}
    >
      <Svg width={shape.width} height={shape.height}>
        {shape.ghost ? <Path d={shape.ghost} fill={ghost} /> : null}
        <Path d={shape.lit} fill={lit} />
      </Svg>
    </View>
  );
}
