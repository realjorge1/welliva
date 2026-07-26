/**
 * ArtTile — the fitness module's original, code-drawn workout artwork.
 *
 * Every workout gets a deterministic composition: a rich two-tone gradient
 * (by ArtHue), a decorative pattern (orbit rings, concentric rings, a dot
 * matrix or diagonal beams) and the workout's glyph. No imagery is copied
 * from anywhere — the art is generated from the design system, so it stays
 * sharp at any size and matches both themes.
 */

import { Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { ArtHue, ArtPattern } from "../types";

/** Deep, saturated ramps that hold white glyphs in light AND dark themes. */
const HUE_GRADIENTS: Record<ArtHue, readonly [string, string]> = {
  brand: ["#0E9FC4", "#134E5F"],
  ember: ["#F2784B", "#9E2F23"],
  violet: ["#8B93E6", "#41448F"],
  gold: ["#E0B45C", "#8A6420"],
  teal: ["#2DBE9F", "#0F5847"],
  sky: ["#5BB8E8", "#215A80"],
  rose: ["#E86E96", "#7E2244"],
  forest: ["#63B06A", "#1F4D2A"],
  slate: ["#8B99AD", "#39414E"],
  midnight: ["#6B7BD6", "#1E2860"],
};

export interface ArtTileProps {
  icon: string;
  hue: ArtHue;
  pattern?: ArtPattern;
  size?: number;
  radius?: number;
}

/** The signature orbit decoration (the module's original composition). */
function OrbitDecor({ size }: { size: number }) {
  const ring = size * 0.9;
  const ringSm = size * 0.5;
  return (
    <>
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            top: -ring * 0.35,
            right: -ring * 0.3,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          styles.ringFaint,
          {
            width: ringSm,
            height: ringSm,
            borderRadius: ringSm / 2,
            bottom: -ringSm * 0.28,
            left: -ringSm * 0.22,
          },
        ]}
      />
      <View style={[styles.bar, { width: size * 1.5, top: size * 0.72 }]} />
    </>
  );
}

/** Concentric rings radiating from the bottom-left corner. */
function RingsDecor({ size }: { size: number }) {
  return (
    <>
      {[0.62, 0.92, 1.22].map((f, i) => {
        const d = size * f;
        return (
          <View
            key={i}
            style={[
              styles.ring,
              i > 0 && styles.ringFaint,
              {
                width: d,
                height: d,
                borderRadius: d / 2,
                bottom: -d / 2,
                left: -d / 2,
              },
            ]}
          />
        );
      })}
    </>
  );
}

/** A faint offset dot matrix drifting out of the top-left corner. */
function DotsDecor({ size }: { size: number }) {
  const dot = Math.max(2.5, size * 0.055);
  const gap = size * 0.19;
  const dots: { x: number; y: number }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      dots.push({ x: size * 0.06 + c * gap, y: size * 0.06 + r * gap });
    }
  }
  return (
    <>
      {dots.map((p, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              left: p.x,
              top: p.y,
              opacity: 0.16 - (i % 4) * 0.02,
            },
          ]}
        />
      ))}
    </>
  );
}

/** Three parallel diagonal beams sweeping across the tile. */
function BeamsDecor({ size }: { size: number }) {
  return (
    <>
      {[0.22, 0.5, 0.78].map((f, i) => (
        <View
          key={i}
          style={[
            styles.beam,
            {
              width: size * 1.8,
              height: size * 0.09,
              top: size * f,
              left: -size * 0.4,
              opacity: 0.12 - i * 0.03,
            },
          ]}
        />
      ))}
    </>
  );
}

export const ArtTile = React.memo(function ArtTile({
  icon,
  hue,
  pattern = "orbit",
  size = 64,
  radius = Radius.lg,
}: ArtTileProps) {
  const colors = HUE_GRADIENTS[hue] ?? HUE_GRADIENTS.brand;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {pattern === "orbit" && <OrbitDecor size={size} />}
      {pattern === "rings" && <RingsDecor size={size} />}
      {pattern === "dots" && <DotsDecor size={size} />}
      {pattern === "beams" && <BeamsDecor size={size} />}
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size * 0.44} color="#FFFFFF" />
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },
  ringFaint: { borderColor: "rgba(255,255,255,0.13)" },
  bar: {
    position: "absolute",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.10)",
    transform: [{ rotate: "-18deg" }],
  },
  dot: { position: "absolute", backgroundColor: "#FFFFFF" },
  beam: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "-24deg" }],
  },
});
