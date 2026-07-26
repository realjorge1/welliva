/**
 * WHAT WELLIVA KNOWS — one home for the two transparency surfaces that used to
 * sit as separate entries under More. A segmented control swaps between:
 *   • Memory   — everything the Personal Health OS remembers (the Memory Center)
 *   • Upcoming — the life context Gozlin coaches around (What's coming up)
 *
 * Both panels are the existing full screens rendered in `embedded` mode: they
 * drop their own back-button header and ambient gradient so this shell can own
 * the chrome. The standalone routes (/memory-center, /life) still exist for the
 * deep links from Profile, Gozlin, and Privacy.
 */
import { AmbientCanvas, AppText, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LifeScreen from "./life";
import MemoryCenterScreen from "./memory-center";

type Segment = "memory" | "upcoming";

const SEGMENTS: { key: Segment; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "memory", label: "Memory", icon: "sparkles" },
  { key: "upcoming", label: "Upcoming", icon: "planet" },
];

export default function KnowsScreen() {
  const { colors } = useColors();
  const [seg, setSeg] = useState<Segment>("memory");

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* Chrome: back + title + segmented control */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <AppText variant="title" style={styles.headerTitle}>
              What Welliva knows
            </AppText>
            <View style={styles.iconBtn} />
          </View>

          <View style={[styles.segment, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            {SEGMENTS.map((s) => {
              const on = seg === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSeg(s.key)}
                  style={[styles.segItem, on && { backgroundColor: colors.primary }]}
                >
                  <Ionicons
                    name={s.icon}
                    size={16}
                    color={on ? colors.onPrimary : colors.textSecondary}
                  />
                  <AppText
                    variant="footnote"
                    color={on ? colors.onPrimary : "secondary"}
                    style={styles.segLabel}
                  >
                    {s.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Active panel — the existing screens, chrome-less */}
        <View style={styles.flex}>
          {seg === "memory" ? (
            <MemoryCenterScreen embedded />
          ) : (
            <LifeScreen embedded />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  segLabel: {
    fontWeight: "600",
  },
});
