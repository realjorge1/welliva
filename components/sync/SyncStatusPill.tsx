/**
 * SYNC STATUS PILL — quiet, and absent when there's nothing to say.
 *
 * The app's whole voice is calm, so this is not a red banner. It appears only
 * when something is genuinely unresolved (offline, or changes still queued) and
 * disappears the moment the queue drains. A user who is online and synced —
 * almost always — never sees it at all.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { describeSyncStatus, useSyncStatus } from "@/services/sync/useSyncStatus";

export function SyncStatusPill({ style }: { style?: View["props"]["style"] }) {
  const { colors } = useColors();
  const status = useSyncStatus();

  // Nothing unresolved → nothing on screen. This is the common case.
  if (status.state === "synced") return null;
  // `local` (free tier, cloud backup off) is a steady state, not an unresolved
  // one — there is no queue and nothing is failing. A pill that never goes away
  // would be a permanent upsell badge on top of the user's data, which is both
  // nagging and against this component's whole reason for existing. The honest
  // disclosure lives on the Settings sync row, where someone is actually asking.
  if (status.state === "local") return null;

  const tone =
    status.state === "error"
      ? colors.warning
      : status.state === "offline"
        ? colors.textTertiary
        : colors.primary;

  const icon =
    status.state === "offline"
      ? "cloud-offline-outline"
      : status.state === "error"
        ? "alert-circle-outline"
        : "cloud-upload-outline";

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: alpha(tone, 0.12), borderColor: alpha(tone, 0.3) },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={describeSyncStatus(status)}
    >
      <Ionicons name={icon} size={13} color={tone} />
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {describeSyncStatus(status)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
