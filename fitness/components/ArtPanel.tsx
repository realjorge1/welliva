/**
 * ArtPanel — a workout's art as the full-height media edge of a list card.
 *
 * The same composition as {@link ArtTile} (ramp, decor, glyph), stretched to
 * whatever height the card's text needs rather than held in a square tile.
 *
 * WHY THERE IS NO CLIP ON THE GRADIENT
 *
 * Android does not antialias an `overflow: "hidden"` clip on a rounded view,
 * which is what gives a gradient clipped that way its stepped corners. So the
 * gradient here is NOT clipped: expo-linear-gradient draws its own rounded path
 * with an antialiased paint, from the per-corner radii in its style. Only the
 * decor sits inside a clipping view, because the decor is meant to run off the
 * edges; it is faint white, so a hard clip edge on it doesn't show. The corners
 * people actually look at are the gradient's, and those stay smooth.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import type { ArtHue, ArtPattern } from "../types";
import { ART_GRADIENTS, ArtDecor } from "./ArtTile";

export interface ArtPanelProps {
  icon: string;
  hue: ArtHue;
  pattern?: ArtPattern;
  /** Panel width in px; its height follows the host (it stretches). */
  width: number;
  /** Rounding for the two LEFT corners — the card's inner radius. */
  radius: number;
  /** Space kept clear under the glyph, for an overlay along the bottom edge. */
  glyphInsetBottom?: number;
  /** Overlays drawn above the art (e.g. the duration chip). */
  children?: React.ReactNode;
}

export const ArtPanel = React.memo(function ArtPanel({
  icon,
  hue,
  pattern = "orbit",
  width,
  radius,
  glyphInsetBottom = 0,
  children,
}: ArtPanelProps) {
  const ramp = ART_GRADIENTS[hue] ?? ART_GRADIENTS.brand;
  const corners: ViewStyle = {
    borderTopLeftRadius: radius,
    borderBottomLeftRadius: radius,
  };

  return (
    <View style={[styles.panel, { width }]}>
      <LinearGradient
        colors={ramp}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[StyleSheet.absoluteFill, corners]}
      />
      <View style={[StyleSheet.absoluteFill, corners, styles.decorClip]} pointerEvents="none">
        <ArtDecor pattern={pattern} size={width} />
      </View>
      <View style={[styles.glyph, { paddingBottom: glyphInsetBottom }]} pointerEvents="none">
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={Math.round(width * 0.34)}
          color="#FFFFFF"
        />
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: { alignSelf: "stretch" },
  decorClip: { overflow: "hidden" },
  glyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
