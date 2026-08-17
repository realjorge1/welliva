/**
 * FoodLookupSheet — "we don't have that. Want us to find it?"
 *
 * Opens only from a genuinely empty search (see FoodLookupService's local-first
 * rule), asks the server, and shows what came back so the user picks before
 * anything is saved. Nothing is added to their food list without that pick.
 *
 * ── THE ONE THING THIS SCREEN MUST GET RIGHT ────────────────────────────────
 * Two very different kinds of answer arrive through the same door:
 *
 *   USDA        — a laboratory measured this. There's an id you can look up.
 *   AI estimate — nobody measured it. A model reasoned from a typical recipe.
 *
 * They are NOT presented as a ranked list of equals. Measured results carry a
 * green verified badge and their FDC id; estimates carry a warning-toned badge
 * that says "AI estimate" in as many words, plus a standing caution above the
 * group. A user who adds an estimate should know they did, at the moment they
 * did it — not discover it later from a colour on a label.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { LookupCandidate } from "@/services/nutrition/FoodLookupService";

export interface FoodLookupSheetProps {
  visible: boolean;
  query: string;
  state: "idle" | "loading" | "done" | "error";
  candidates: LookupCandidate[];
  error?: string;
  onClose: () => void;
  onRetry: () => void;
  onPick: (candidate: LookupCandidate) => void;
}

export function FoodLookupSheet({
  visible,
  query,
  state,
  candidates,
  error,
  onClose,
  onRetry,
  onPick,
}: FoodLookupSheetProps) {
  const { colors } = useColors();
  // A Modal renders outside the Screen's SafeAreaView — same clamp as the other
  // two sheets; see FoodDetailSheet for why it isn't the raw inset.
  const insets = useSafeAreaInsets();
  const headerTop = Math.max(Spacing.lg, Math.min(insets.top, 24) + Spacing.sm);

  const measured = candidates.filter((c) => c.source.kind === "usda");
  const estimated = candidates.filter((c) => c.source.kind === "ai-estimate");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View
          style={[styles.header, { borderBottomColor: colors.border, paddingTop: headerTop }]}
        >
          <View style={styles.headerText}>
            <AppText variant="headline" weight="700" numberOfLines={1}>
              {query}
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {state === "loading"
                ? "Checking food databases…"
                : state === "done" && candidates.length > 0
                  ? `${candidates.length} match${candidates.length === 1 ? "" : "es"} — pick one to add`
                  : "Not in our catalog"}
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {state === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="subhead" color="secondary" style={styles.centerText}>
                Searching USDA&apos;s food database first. If they don&apos;t have
                it, Gozlin will estimate it.
              </AppText>
            </View>
          ) : null}

          {state === "error" ? (
            <View style={styles.center}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.textTertiary} />
              <AppText variant="headline">Couldn&apos;t search</AppText>
              <AppText variant="subhead" color="secondary" style={styles.centerText}>
                {error ?? "Something went wrong looking that up."}
              </AppText>
              <Button label="Try again" size="sm" onPress={onRetry} />
            </View>
          ) : null}

          {state === "done" && candidates.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={34} color={colors.textTertiary} />
              <AppText variant="headline">No match anywhere</AppText>
              <AppText variant="subhead" color="secondary" style={styles.centerText}>
                Neither USDA nor Gozlin could identify “{query}”. Try a simpler
                name — “abacha” rather than “my aunt&apos;s abacha”.
              </AppText>
            </View>
          ) : null}

          {measured.length > 0 ? (
            <>
              <SectionLabel
                icon="shield-checkmark"
                tone={colors.success}
                title="Measured"
                caption="From USDA FoodData Central — you can verify every one of these."
              />
              {measured.map((c) => (
                <CandidateRow key={c.key} candidate={c} onPress={() => onPick(c)} />
              ))}
            </>
          ) : null}

          {estimated.length > 0 ? (
            <>
              <SectionLabel
                icon="sparkles"
                tone={colors.warning}
                title="AI estimate"
                caption="No food composition table covers this, so these are Gozlin's estimate from a typical recipe — not a measurement. They'll stay labelled as an estimate wherever they appear."
              />
              {estimated.map((c) => (
                <CandidateRow key={c.key} candidate={c} onPress={() => onPick(c)} />
              ))}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionLabel({
  icon,
  tone,
  title,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  caption: string;
}) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={14} color={tone} />
        <AppText variant="caption" weight="700" uppercase style={{ color: tone }}>
          {title}
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary" style={styles.sectionCaption}>
        {caption}
      </AppText>
    </View>
  );
}

function CandidateRow({
  candidate,
  onPress,
}: {
  candidate: LookupCandidate;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const isMeasured = candidate.source.kind === "usda";
  const tone = isMeasured ? colors.success : colors.warning;
  const kcal = candidate.nutrients.calories;

  // The citation line. For USDA this is a verifiable id; for an estimate it's
  // what the model reasoned from. Either way the user sees the basis.
  const basis =
    candidate.source.kind === "usda"
      ? `USDA #${candidate.source.fdcId}`
      : candidate.source.kind === "ai-estimate"
        ? candidate.source.description
        : "";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${candidate.name}, ${kcal !== undefined ? `${Math.round(kcal)} calories` : "calories unknown"} per ${candidate.serving}`}
      accessibilityHint={
        isMeasured
          ? "Adds this measured food to your list"
          : "Adds this AI estimate to your list, labelled as an estimate"
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: alpha(tone, 0.3),
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <View style={styles.rowMain}>
        <AppText variant="callout" weight="600" numberOfLines={2}>
          {candidate.name}
        </AppText>
        <AppText variant="footnote" color="tertiary" numberOfLines={1}>
          {candidate.serving}
          {candidate.servingGrams !== null ? ` · ${Math.round(candidate.servingGrams)} g` : ""}
          {` · P ${candidate.nutrients.protein ?? 0}g · C ${candidate.nutrients.carbs ?? 0}g · F ${candidate.nutrients.fat ?? 0}g`}
        </AppText>
        {basis ? (
          <AppText variant="caption" color="tertiary" numberOfLines={1} style={styles.basis}>
            {basis}
          </AppText>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.kcalPill, { backgroundColor: alpha(colors.calories, 0.14) }]}>
          <AppText variant="footnote" weight="700" style={{ color: colors.calories }}>
            {kcal !== undefined ? Math.round(kcal) : "—"}
          </AppText>
          <AppText variant="caption" style={{ color: colors.calories }}>
            kcal
          </AppText>
        </View>
        <Ionicons name="add-circle" size={24} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.giant, gap: Spacing.sm },
  center: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.giant,
    paddingHorizontal: Spacing.lg,
  },
  centerText: { textAlign: "center", lineHeight: 20 },
  sectionLabel: { marginTop: Spacing.lg, marginBottom: Spacing.xs, gap: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionCaption: { lineHeight: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rowMain: { flex: 1, gap: 2 },
  basis: { marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  kcalPill: {
    minWidth: 52,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    alignItems: "center",
  },
});
