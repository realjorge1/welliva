/**
 * Mono — the instrument face.
 *
 * One typeface, used for one job: figures and codes that are being READ OFF
 * something rather than said. A day counter, a target, a receipt, a status
 * word on a coach card. SpaceMono is already bundled and loaded at root
 * (app/_layout.tsx), so this costs nothing but the discipline of using it.
 *
 * ── WHY A SECOND FACE AT ALL ────────────────────────────────────────────────
 *
 * The app's whole claim is that its numbers come from somewhere. Prose and
 * measurement set in the same face read as the same kind of statement, and they
 * are not: "you're doing well" is an opinion and "DAY 12" is an instrument
 * reading. Giving the readings a fixed-width, slightly technical face is the
 * cheapest way to say which is which without a single word of explanation —
 * and it is the difference between a card that looks designed and a card that
 * looks typed.
 *
 * ── AND WHY IT IS RATIONED ──────────────────────────────────────────────────
 *
 * Mono is a spice. Set a sentence in it and the screen becomes a terminal
 * emulator, which is a costume rather than a design. The rule is: a value, a
 * unit, a label ABOVE a value, or a short status token. Never a clause, never
 * body copy, never anything with a verb in it.
 *
 * TABULAR BY CONSTRUCTION. A fixed-width face is what stops a rolling figure
 * from shifting its neighbours as it changes width — the reason to reach for
 * this on a live readout, over and above the tone it sets.
 *
 * It carries `maxFontSizeMultiplier` for the same reason `AppText` does: these
 * sit inside fixed-height pills and strips, and a 3.5× accessibility scale
 * would push a readout straight out of its chip.
 */

import { Text, type TextProps, type TextStyle } from "react-native";
import React from "react";
import { useColors } from "./useColors";

/** The bundled face. Kept in one place so a swap is a one-line change. */
export const MONO_FAMILY = "SpaceMono";

export interface MonoProps extends TextProps {
  /** Point size. There is no scale here on purpose — readouts are sized to fit. */
  size?: number;
  /**
   * SpaceMono ships one weight, so this is a synthetic weight the platform
   * applies. It reads as a subtle thickening rather than a real bold, which is
   * the correct amount of emphasis for a readout.
   */
  weight?: TextStyle["fontWeight"];
  /** Resolved colour. Defaults to the theme's secondary text. */
  color?: string;
  /** Extra tracking. Mono is already wide; positive values are for LABELS only. */
  tracking?: number;
}

export function Mono({
  size = 12,
  weight = "400",
  color,
  tracking = 0,
  style,
  ...rest
}: MonoProps) {
  const { colors } = useColors();
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[
        {
          fontFamily: MONO_FAMILY,
          fontSize: size,
          // Mono faces sit low in the box; a line height tied to the size keeps
          // a readout optically centred in a pill instead of hanging.
          lineHeight: Math.round(size * 1.32),
          fontWeight: weight,
          letterSpacing: tracking,
          color: color ?? colors.textSecondary,
        },
        style,
      ]}
      {...rest}
    />
  );
}
