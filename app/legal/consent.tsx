/**
 * CONSENT GATE — the one screen between a successful sign-in and onboarding.
 *
 * Welliva asks for pregnancy status, medical conditions, medications, injuries
 * and body photos on the very next screen. Asking for that before the user has
 * been told what happens to it is not defensible — legally or otherwise. So this
 * gate is a HARD stop: nothing advances until the box is ticked.
 *
 * Design rules:
 *  • The summary is a digest of the real documents (constants/legal.ts), not
 *    marketing copy — including the "we are not a doctor" card, which carries
 *    the warning tone because it's the one people skim past.
 *  • Every claim links to the full text, readable right here, before agreeing.
 *  • No dismiss, no skip, no hardware-back escape. The only other exit is
 *    "Decline and sign out" — a real choice, not a dark pattern.
 *  • Accepting records the version accepted, so a future policy change re-gates.
 *
 * Routing lives in AuthWrapper: once the gate flips to `accepted`, it forwards
 * to onboarding (or the tabs, for a returning user). This screen never navigates
 * forward itself — one router, one decision.
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { useLegalGate } from "@/components/legal";
import { AmbientCanvas, AppText, Button, Card, IconBadge, useColors } from "@/components/ui";
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import {
  CONSENT_CHECKBOX_LABEL,
  CONSENT_SUMMARY,
  LEGAL_DOCS,
  LEGAL_DOC_ORDER,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
  type ConsentSummaryCard,
} from "@/constants/legal";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ConsentScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { signOut } = useAuth();
  const { accept } = useLegalGate();

  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Android hardware back must not slip past the gate. Returning true swallows
  // the press; the deliberate exit is "Decline and sign out" below.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const toggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setChecked((c) => !c);
  }, []);

  const onAccept = useCallback(async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      await accept();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      // No navigation here — AuthWrapper reacts to the accepted status and
      // forwards to onboarding or the tabs.
    } catch (e) {
      console.error("Consent: failed to record acceptance", e);
      setSaving(false);
      Alert.alert(
        "Couldn't save that",
        "Something went wrong storing your acceptance. Please try again.",
      );
    }
  }, [checked, saving, accept]);

  const onDecline = useCallback(() => {
    Alert.alert(
      "Decline and sign out?",
      "Welliva needs your agreement to build a plan around your health details. You can sign back in and accept at any time.",
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (e) {
              console.error("Consent: sign out failed", e);
            }
          },
        },
      ],
    );
  }, [signOut]);

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <AILogoBadge size={56} />
            <AppText variant="display" align="center" style={styles.title}>
              Before we begin
            </AppText>
            <AppText
              variant="body"
              color="secondary"
              align="center"
              style={styles.lede}
            >
              Welliva is about to ask personal health questions so it can build
              your plan. Here&apos;s exactly what that means — the short version,
              in plain language.
            </AppText>
          </View>

          {CONSENT_SUMMARY.map((card) => (
            <SummaryCard key={card.title} card={card} />
          ))}

          {/* The full documents */}
          <Card padding="none" style={styles.docCard}>
            {LEGAL_DOC_ORDER.map((id, i) => {
              const doc = LEGAL_DOCS[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => router.push(`/legal/${id}` as never)}
                  style={[
                    styles.docRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.divider,
                    },
                  ]}
                >
                  <IconBadge name={doc.icon as never} tone={colors.primary} size={38} />
                  <View style={styles.flex}>
                    <AppText variant="callout">{doc.title}</AppText>
                    <AppText variant="caption" color="tertiary" style={styles.docSub}>
                      {doc.summary}
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textTertiary}
                  />
                </Pressable>
              );
            })}
          </Card>

          <AppText variant="caption" color="tertiary" align="center" style={styles.stamp}>
            Version {LEGAL_VERSION} · Last updated {LEGAL_LAST_UPDATED}
          </AppText>
        </ScrollView>

        {/* Sticky decision bar — the only way forward */}
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.divider, backgroundColor: colors.background },
          ]}
        >
          <Pressable
            onPress={toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={CONSENT_CHECKBOX_LABEL}
            style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <View
              style={[
                styles.box,
                {
                  borderColor: checked ? colors.primary : colors.border,
                  backgroundColor: checked ? colors.primary : "transparent",
                },
              ]}
            >
              {checked ? (
                <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
              ) : null}
            </View>
            <AppText variant="footnote" color="secondary" style={styles.checkLabel}>
              {CONSENT_CHECKBOX_LABEL}
            </AppText>
          </Pressable>

          <Button
            label={saving ? "Saving…" : "Accept & continue"}
            icon="arrow-forward"
            iconRight
            disabled={!checked || saving}
            loading={saving}
            onPress={onAccept}
          />

          <Pressable onPress={onDecline} hitSlop={8} style={styles.declineBtn}>
            <AppText variant="footnote" color="tertiary">
              Decline and sign out
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

function SummaryCard({ card }: { card: ConsentSummaryCard }) {
  const { colors } = useColors();
  const tone = card.emphasis ? colors.warning : colors.primary;

  return (
    <Card
      padding="lg"
      style={[
        styles.card,
        card.emphasis && {
          borderColor: alpha(colors.warning, 0.35),
          backgroundColor: alpha(colors.warning, 0.07),
        },
      ]}
    >
      <View style={styles.cardHead}>
        <IconBadge name={card.icon as never} tone={tone} size={40} />
        <AppText variant="headline" style={styles.flex}>
          {card.title}
        </AppText>
      </View>
      {card.lines.map((line) => (
        <View key={line} style={styles.lineRow}>
          <View style={[styles.dot, { backgroundColor: tone }]} />
          <AppText variant="subhead" color="secondary" style={styles.flex}>
            {line}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },

  hero: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { marginTop: Spacing.sm },
  lede: { paddingHorizontal: Spacing.sm },

  card: { gap: Spacing.xs },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },

  docCard: { marginTop: Spacing.sm },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  docSub: { marginTop: 2 },

  stamp: { marginTop: Spacing.md },

  footer: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  box: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkLabel: { flex: 1, lineHeight: 18 },
  declineBtn: { alignSelf: "center", paddingVertical: Spacing.xs },
});
