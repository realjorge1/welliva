/**
 * ExerciseDemo — the ExerciseDB demonstration GIF for one exercise.
 *
 * Reference content, not the hero: it plays through ONCE when presented, then
 * settles under a quiet scrim with a replay affordance (tap anywhere replays).
 * Never loops through a whole set. Renders nothing when media is unconfigured
 * or unresolved, so every host screen works offline exactly as before.
 *
 * The GIF bytes are cached on disk by expo-image; pausing is done by toggling
 * `autoplay` (frozen frame) with the scrim as a guaranteed visual stop even if
 * a platform ignores the toggle. Honors OS reduced-motion: starts paused.
 */
import { AppText, useColors } from "@/components/ui";
import { enterFade } from "@/components/motion";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useExerciseDemo } from "../hooks/useExerciseDemo";

/** How long one presentation runs before settling (≈ two GIF loops). */
const PLAY_WINDOW_MS = 4500;

export interface ExerciseDemoProps {
  exerciseId: string;
  exerciseName: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ExerciseDemo({
  exerciseId,
  exerciseName,
  height = 170,
  style,
}: ExerciseDemoProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const { url } = useExerciseDemo(exerciseId, exerciseName);

  // Bumping the key remounts the image → the GIF restarts from frame 0.
  const [runKey, setRunKey] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [hasPlayed, setHasPlayed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // New exercise (or newly resolved URL) → fresh presentation.
  useEffect(() => {
    setRunKey(0);
    setPlaying(!reduced);
    setHasPlayed(false);
    return clearTimer;
  }, [url, reduced]);

  const handleLoaded = useCallback(() => {
    if (reduced) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setPlaying(false);
      setHasPlayed(true);
    }, PLAY_WINDOW_MS);
  }, [reduced]);

  const handleReplay = useCallback(() => {
    clearTimer();
    setRunKey((k) => k + 1);
    setPlaying(true);
    setHasPlayed(true);
  }, []);

  if (!url) return null;

  return (
    <Pressable
      onPress={handleReplay}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${exerciseName} demonstration — tap to replay`}
      style={[
        styles.frame,
        { height, borderColor: colors.border },
        style,
      ]}
    >
      <Image
        key={runKey}
        source={{ uri: url }}
        style={styles.image}
        contentFit="contain"
        transition={220}
        autoplay={playing}
        onLoad={handleLoaded}
      />
      {!playing && (
        <Animated.View
          entering={enterFade()}
          style={[styles.scrim, { backgroundColor: alpha("#0A1214", 0.32) }]}
        >
          <View style={[styles.replayChip, { backgroundColor: alpha("#0A1214", 0.55) }]}>
            <Ionicons name={hasPlayed ? "refresh" : "play"} size={14} color="#FFFFFF" />
            <AppText variant="caption" style={styles.replayText} uppercase>
              {hasPlayed ? "Replay demo" : "Play demo"}
            </AppText>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    // ExerciseDB GIFs are drawn on white — own it as a deliberate light panel.
    backgroundColor: "#FFFFFF",
    width: "100%",
  },
  image: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  replayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  replayText: { color: "#FFFFFF" },
});
