/**
 * MusicDock — the in-session music controller.
 *
 * A slim, glanceable strip for the guided session: current beat + BPM,
 * play/pause, next track and mute. Volume lives in Fitness Settings to keep
 * mid-workout controls big and simple. Purely presentational — all state
 * comes from useBeatPlayer, so the dock renders nothing heavy.
 */

import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { UseBeatPlayer } from "../hooks/useBeatPlayer";

export function MusicDock({ player }: { player: UseBeatPlayer }) {
  const { colors } = useColors();
  return (
    <View
      style={[
        styles.dock,
        { backgroundColor: alpha(colors.primary, 0.1), borderColor: colors.border },
      ]}
    >
      <Ionicons name="musical-notes" size={16} color={colors.primary} />
      <View style={styles.info}>
        <AppText variant="footnote" numberOfLines={1} style={styles.title}>
          {player.beat.title}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {player.beat.bpm} BPM
        </AppText>
      </View>
      <DockButton
        icon={player.playing ? "pause" : "play"}
        label={player.playing ? "Pause music" : "Play music"}
        onPress={player.toggle}
        tint={colors.primary}
      />
      <DockButton
        icon="play-skip-forward"
        label="Next track"
        onPress={player.next}
        tint={colors.text}
      />
      <DockButton
        icon={player.muted ? "volume-mute" : "volume-medium"}
        label={player.muted ? "Unmute music" : "Mute music"}
        onPress={player.toggleMute}
        tint={player.muted ? colors.textTertiary : colors.text}
      />
    </View>
  );
}

function DockButton({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  info: { flex: 1 },
  title: { fontWeight: "700" },
  btn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.8 },
});
