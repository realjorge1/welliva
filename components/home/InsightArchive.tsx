/**
 * InsightArchive — every insight the user has opened, to read again.
 *
 * Insights behave like notifications (see services/gozlin/InsightLedger): once
 * one is opened it leaves Home and does not return until there is a new one.
 * That is only a fair deal if "gone" doesn't mean "lost", so this is where they
 * are kept. It opens from two places — Gozlin's menu and Memory — and is the
 * same sheet from both.
 *
 * ── PRO KEEPS THE LIST; FREE KEEPS THE INSIGHTS ─────────────────────────────
 *
 * Getting an insight and opening it are free. The history is the paid part
 * (`insight-history`). A free user is shown how many they have opened — a true
 * count of work already done — rather than an empty lock, and nothing is
 * withheld from them in the moment: the entries are recorded either way, so
 * upgrading reveals a history that is already there.
 *
 * ── ONE MODAL AT A TIME ─────────────────────────────────────────────────────
 *
 * The sheet and the deep dive are both `Modal`s, and React Native will not
 * present a second while the first is mounted. So a tap files what it wants
 * done in a ref and the work runs from the sheet's `onClosed`, when the screen
 * is genuinely clear — the same hand-off the weigh-in and check-in sheets use.
 */
import { useBilling } from "@/contexts/BillingContext";
import { useHabitReport } from "@/components/gozlin";
import { AppText, Button, IconBadge, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { InsightEntry } from "@/services/gozlin/InsightLedger";
import { TIER_NAME, featureMinTier } from "@/services/billing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CoachDeepDive } from "./CoachDeepDive";
import type { CoachCard } from "./coachDeck";
import { useInsightLedger } from "./useInsightLedger";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function InsightArchive({ visible, onClose }: Props) {
  const { colors } = useColors();
  const { ledger } = useInsightLedger();
  const { allows, isHydrating, openUpgrade } = useBilling();

  // Mirrors PaywallGate's optimistic rule: a paying user must not see a frame of
  // the lock while the cached entitlement loads.
  const unlocked = allows("insight-history") || isHydrating;

  const [selected, setSelected] = useState<CoachCard | null>(null);
  /** What to do once the sheet has finished closing. See the header. */
  const after = useRef<(() => void) | null>(null);

  const groups = useMemo(() => {
    const out: { label: string; items: InsightEntry[] }[] = [];
    for (const e of [...ledger].sort((a, b) => b.openedAt.localeCompare(a.openedAt))) {
      const label = bucket(e.openedAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [ledger]);

  const openEntry = useCallback(
    (e: InsightEntry) => {
      Haptics.selectionAsync().catch(() => {});
      after.current = () => setSelected(e.card as CoachCard);
      onClose();
    },
    [onClose],
  );

  const goUpgrade = useCallback(() => {
    after.current = () => openUpgrade("insight-history");
    onClose();
  }, [onClose, openUpgrade]);

  const onClosed = useCallback(() => {
    const run = after.current;
    after.current = null;
    run?.();
  }, []);

  const count = ledger.length;

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="headline">Insight history</AppText>
        <AppText variant="footnote" color="tertiary" style={styles.sub}>
          {count === 0
            ? "Nothing opened yet"
            : `${count} ${count === 1 ? "insight" : "insights"} opened`}
        </AppText>
      </View>
    </View>
  );

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        onClosed={onClosed}
        header={header}
        maxHeightRatio={0.78}
      >
        {!unlocked ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.gold, 0.14) }]}>
              <Ionicons name="albums-outline" size={24} color={colors.gold} />
            </View>
            <AppText variant="subhead" weight="600" align="center" style={styles.emptyTitle}>
              {count > 0
                ? `You've opened ${count} ${count === 1 ? "insight" : "insights"}`
                : "Every insight you open, kept"}
            </AppText>
            <AppText variant="subhead" color="secondary" align="center" style={styles.emptyText}>
              New insights and opening them are free, always. Pro keeps each one you open so
              you can read it again — I&apos;ve been saving yours.
            </AppText>
            <Button
              label={`See ${TIER_NAME[featureMinTier("insight-history")]}`}
              icon="arrow-forward"
              iconRight
              onPress={goUpgrade}
              style={styles.cta}
            />
          </View>
        ) : count === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.primary, 0.12) }]}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
            </View>
            <AppText variant="subhead" color="secondary" align="center" style={styles.emptyText}>
              Open an insight on Home and it is kept here. Once you&apos;ve read one it
              leaves Home until there&apos;s something new.
            </AppText>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((g) => (
              <React.Fragment key={g.label}>
                <AppText
                  variant="caption"
                  weight="700"
                  color="tertiary"
                  style={styles.groupLabel}
                >
                  {g.label.toUpperCase()}
                </AppText>
                {g.items.map((e) => {
                  const tone =
                    e.card.tone === "positive"
                      ? colors.success
                      : e.card.tone === "warning"
                        ? colors.warning
                        : colors.primary;
                  return (
                    <Pressable
                      key={e.key}
                      onPress={() => openEntry(e)}
                      accessibilityRole="button"
                      accessibilityLabel={`${e.card.title}. ${e.card.message}`}
                      accessibilityHint={`Opened ${when(e.openedAt)}. Opens it again.`}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { backgroundColor: alpha(colors.text, 0.06) },
                      ]}
                    >
                      <IconBadge name={e.card.icon as never} tone={tone} size={36} />
                      <View style={styles.flex}>
                        <AppText variant="body" weight="600" numberOfLines={1}>
                          {e.card.title}
                        </AppText>
                        <AppText variant="footnote" color="secondary" numberOfLines={2}>
                          {e.card.message}
                        </AppText>
                        <AppText variant="caption" color="tertiary" style={styles.when}>
                          {when(e.openedAt)}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </React.Fragment>
            ))}
          </ScrollView>
        )}
      </Sheet>

      {/* Mounted only while an entry is open, so the habit report behind the
          dive is never built for someone who just glanced at the list. */}
      {selected ? <ArchiveDive card={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function ArchiveDive({ card, onClose }: { card: CoachCard; onClose: () => void }) {
  const report = useHabitReport();
  return <CoachDeepDive insight={card} report={report} onClose={onClose} />;
}

/* ── Dates ── */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (iso: string) =>
  Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);

/** Three headings and no more — the same ones Chat history uses. */
function bucket(iso: string): string {
  const days = daysAgo(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return "Earlier";
}

/** "Today", "Yesterday", "3 days ago", then a plain date. */
function when(iso: string): string {
  const days = daysAgo(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const then = new Date(iso);
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sub: { marginTop: 2 },

  list: { flexGrow: 0 },
  listContent: { gap: 2, paddingBottom: Spacing.xs },
  groupLabel: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  when: { marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: Spacing.md },
  emptyText: { marginTop: Spacing.sm, lineHeight: 20 },
  cta: { marginTop: Spacing.lg, alignSelf: "stretch" },
});
