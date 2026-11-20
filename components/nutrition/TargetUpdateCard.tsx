/**
 * TARGET UPDATE CARD — the once-shown "why your number changed", and the
 * one-tap offers that may change it.
 *
 * Same family as TargetsRecalcCard, for a different kind of move. That card
 * explains a CORRECTION (the app's formula was wrong). This one explains a move
 * that came from her: her weight trend moved her numbers, or she has an offer
 * waiting (ease the pace, the burn the app learned, a different activity
 * level). A pending offer outranks an unseen move: it needs her answer.
 *
 * Content comes from services/nutrition/weightRetarget (moves) and
 * services/nutrition/targetOffers (offers); this only renders and answers.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import { pendingOffer, type TargetOffer } from "@/services/nutrition/targetOffers";
import {
  latestUnseenMove,
  markMovesSeen,
  type TargetMove,
} from "@/services/nutrition/weightRetarget";

const OFFER_TITLE: Record<TargetOffer["id"], string> = {
  pace_guard: "Ease your pace?",
  learned: "Numbers that fit you better",
  activity: "Your activity level",
};

export function TargetUpdateCard({ style }: { style?: View["props"]["style"] }) {
  const { colors } = useColors();
  const { nutritionTargets, answerTargetOffer } = useProfile();
  const [offer, setOffer] = useState<TargetOffer | null>(null);
  const [move, setMove] = useState<TargetMove | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-read whenever her numbers change: that is exactly when a move lands.
  useEffect(() => {
    let alive = true;
    void Promise.all([pendingOffer(), latestUnseenMove()]).then(([o, m]) => {
      if (!alive) return;
      setOffer(o);
      setMove(m);
    });
    return () => {
      alive = false;
    };
  }, [nutritionTargets?.calories, nutritionTargets?.proteinG]);

  if (!offer && !move) return null;

  const tint = colors.primary;
  const shell = [
    styles.card,
    { backgroundColor: alpha(tint, 0.1), borderColor: alpha(tint, 0.3) },
    style,
  ];

  if (offer) {
    const answer = async (accept: boolean) => {
      if (busy) return;
      setBusy(true);
      setOffer(null); // optimistic: the question never lingers after a tap
      try {
        await answerTargetOffer(offer, accept);
      } finally {
        setBusy(false);
      }
    };
    return (
      <View style={shell}>
        <View style={styles.head}>
          <Ionicons name="options-outline" size={18} color={tint} />
          <AppText variant="callout">{OFFER_TITLE[offer.id]}</AppText>
        </View>
        <AppText variant="footnote" color="secondary" style={styles.copy}>
          {offer.message}
        </AppText>
        <View style={styles.actions}>
          <Button
            label="Use new numbers"
            variant="tonal"
            size="sm"
            onPress={() => void answer(true)}
            disabled={busy}
            style={styles.flex}
          />
          <Button
            label="Keep mine"
            variant="ghost"
            size="sm"
            onPress={() => void answer(false)}
            disabled={busy}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  const acknowledge = () => {
    if (!move) return;
    setMove(null);
    void markMovesSeen(move.id);
  };

  return (
    <View style={shell}>
      <View style={styles.head}>
        <Ionicons name="trending-down-outline" size={18} color={tint} />
        <AppText variant="callout">Your numbers moved</AppText>
      </View>
      <AppText variant="footnote" color="secondary" style={styles.copy}>
        {move!.message}
      </AppText>
      <Button label="Got it" variant="tonal" size="sm" onPress={acknowledge} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  copy: { lineHeight: 19 },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  action: { marginTop: Spacing.xs },
});
