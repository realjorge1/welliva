/**
 * AILogoIcon — Gozlin's mark, bare: the gold/cyan diamond that used to be the
 * app icon (owner, 2026-10-15: "current app icon becomes gozlin ai icon … you
 * must get it exactly as is"). It replaced the Ionicons lightning bolt.
 *
 * IT IS THE ARTWORK, NOT A REDRAWING, AND IT IS NEVER TINTED. The raster is
 * cut from `welliva-1024.jpg` itself (see `gozlin-mark.png`): that JPEG is the
 * art composited over black, so it was un-composited — alpha is the brightest
 * channel, colour is pixel ÷ alpha. Laid back over black it returns the icon
 * bit-for-bit; over the app's near-black cards the glow and the flame cut-out
 * let the card through, as a cut-out should. That only holds on DARK surfaces,
 * which is every surface while light mode stays disabled — revisit this file
 * if `LIGHT_MODE_ENABLED` ever flips.
 *
 * The raster is square with the diamond's glow inside it; the diamond itself
 * is ~90% of `size` tall, which is the same share of the box an Ionicons glyph
 * fills, so it drops into any glyph slot at the slot's own size.
 */
import { Image } from "expo-image";
import React from "react";

export const GOZLIN_MARK = require("@/assets/images/gozlin-mark.png");

interface AILogoIconProps {
  size?: number;
}

export default function AILogoIcon({ size = 22 }: AILogoIconProps) {
  return (
    <Image
      source={GOZLIN_MARK}
      style={{ width: size, height: size }}
      contentFit="contain"
      // Decorative everywhere it appears: every caller sits inside a control
      // or next to a label that already says "Gozlin".
      accessible={false}
    />
  );
}
