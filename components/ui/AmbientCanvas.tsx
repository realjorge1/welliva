/**
 * AmbientCanvas — the full-bleed page background every screen floats over.
 *
 * A single soft twilight wash in both themes: `colors.gradient` painted corner
 * to corner, so the canvas always carries the palette's own cool cast and
 * follows any retheme. Nothing is drawn on top of it — it sits *under* the UI
 * as quiet texture and never competes with the brand accents above.
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useColors } from "./useColors";

export function AmbientCanvas() {
  const { colors } = useColors();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
