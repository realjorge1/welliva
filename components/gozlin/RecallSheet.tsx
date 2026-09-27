/**
 * RecallSheet — "where did that come from?", for a memory rather than a number.
 *
 * Opens from a YOU TOLD ME pill under a reply. Shows what they said, when, and
 * how it was captured, and offers to forget it on the spot — the moment someone
 * sees a memory used is exactly when they decide whether they want it kept.
 *
 * THE WORDS ARE READ LIVE, never from the message. The receipt on the message
 * carries only the record's id, name and date (agent/receipts.ts
 * RecallReceipt), so a memory forgotten here — or in Memory, or by Clear
 * memory — reads as forgotten on every old reply that ever used it.
 */

import { AppText, Button, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { SORENESS_WORDS, sayDay, type RecallReceipt } from "@/services/gozlin/agent";
import { forgetExperience, loadExperiences } from "@/services/gozlin/ExperienceStore";
import type { ExperienceRecord } from "@/services/gozlin/novelty";
import { toLocalDateString } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const ENJOYED = { yes: "Liked it", mixed: "Mixed about it", no: "Not for them" } as const;

export function RecallSheet({
  recall,
  onClose,
  onForgotten,
}: {
  recall: RecallReceipt | null;
  onClose: () => void;
  onForgotten?: () => void;
}) {
  const { colors } = useColors();
  const [record, setRecord] = useState<ExperienceRecord | null | "gone">(null);

  useEffect(() => {
    if (!recall) return;
    let alive = true;
    setRecord(null);
    void loadExperiences().then((list) => {
      if (alive) setRecord(list.find((r) => r.id === recall.recordId) ?? "gone");
    });
    return () => {
      alive = false;
    };
  }, [recall]);

  const live = record && record !== "gone" ? record : null;
  const answers = live
    ? [
        live.soreness != null ? SORENESS_WORDS[live.soreness] : null,
        live.enjoyed ? ENJOYED[live.enjoyed] : null,
        ...live.feelings,
      ].filter(Boolean)
    : [];

  return (
    <Sheet
      visible={recall != null}
      onClose={onClose}
      maxHeightRatio={0.7}
      header={
        <View style={styles.header}>
          <AppText variant="caption" color="secondary" style={styles.eyebrow}>
            WHAT YOU TOLD ME
          </AppText>
          <AppText variant="title" weight="600">
            {recall?.label ?? ""}
          </AppText>
        </View>
      }
    >
      <View style={styles.body}>
        {record === "gone" ? (
          <AppText variant="subhead" color="secondary">
            You asked me to forget this, so it&rsquo;s gone.
          </AppText>
        ) : live ? (
          <>
            <View style={[styles.quote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
              <View style={styles.flex}>
                {live.quote ? (
                  <AppText variant="body">&ldquo;{live.quote}&rdquo;</AppText>
                ) : (
                  <AppText variant="body" color="secondary">
                    No words — just a tap.
                  </AppText>
                )}
                {answers.length > 0 ? (
                  <AppText variant="caption" color="secondary" style={styles.answers}>
                    {answers.join(" · ")}
                  </AppText>
                ) : null}
              </View>
            </View>
            <AppText variant="caption" color="secondary">
              {live.triedOn ? `Tried ${sayDay(live.triedOn)}. ` : ""}
              {live.source === "volunteered" ? "You mentioned it" : "You answered"}{" "}
              {sayDay(toLocalDateString(new Date(live.answeredAt)))}.
            </AppText>
            <AppText variant="caption" color="tertiary" style={styles.footnote}>
              One time is one time — Gozlin keeps what you said, not a conclusion about it.
            </AppText>
            <Button
              label="Forget this"
              variant="ghost"
              size="sm"
              icon="trash-outline"
              onPress={() => {
                void forgetExperience(live.id).then(() => {
                  setRecord("gone");
                  onForgotten?.();
                });
              }}
            />
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  eyebrow: { letterSpacing: 1 },
  body: { gap: Spacing.sm, paddingBottom: Spacing.md },
  quote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  flex: { flex: 1 },
  answers: { marginTop: 4 },
  footnote: { lineHeight: 17 },
});
