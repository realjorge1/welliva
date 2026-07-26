/**
 * PRIVACY — "What Gozlin is watching" (the companion's transparency + revoke surface).
 *
 * Every external sense and the out-of-app reach is listed here with a plain-language
 * blurb and an on/off switch the user controls. Turning one off makes its native reads a
 * no-op end-to-end (the Signal adapters are consent-gated). This is the single place the
 * full forward model — connected senses + tracked future events — is visible and
 * revocable, the spine of "the most transparent AI health companion".
 *
 * See docs/companion/00-proactive-companion-blueprint.md §6.
 */
import { AppText, Card, IconBadge, Screen, useColors } from "@/components/ui";
import { useConsent, type ConsentRow } from "@/components/privacy/useConsent";
import {
  useNotificationSettings,
  type UseNotificationSettings,
} from "@/components/notifications/useNotifications";
import { Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

export default function PrivacyScreen() {
  const { colors } = useColors();
  const c = useConsent();
  const notif = useNotificationSettings();

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        What Gozlin watches
      </AppText>
      <View style={styles.iconBtn} />
    </View>
  );

  const core = c.rows.filter((r) => r.group === "core");
  // proactive_notifications has its own card (it needs the OS-permission flow, not just a flip).
  const integrations = c.rows.filter(
    (r) => r.group === "integration" && r.category !== "proactive_notifications",
  );
  const future = c.rows.filter((r) => r.group === "future");

  return (
    <Screen header={header}>
      <AppText variant="subhead" color="secondary" style={styles.intro}>
        Welliva runs on your phone. Your raw history never leaves it — only short summaries
        do, and only for what you switch on below.
      </AppText>

      {/* live status */}
      {!c.loading ? (
        <Card style={styles.block} padding="lg">
          <AppText variant="caption" color="tertiary" uppercase style={styles.kicker}>
            Connected now
          </AppText>
          {c.watching.map((w) => (
            <View key={w.id} style={styles.watchRow}>
              <IconBadge
                name={w.icon as any}
                tone={w.connected ? colors.success : colors.textTertiary}
                size={36}
              />
              <View style={styles.flex}>
                <AppText variant="footnote">{w.label}</AppText>
                <AppText variant="caption" color="tertiary">
                  {w.detail}
                </AppText>
              </View>
              <Ionicons
                name={w.connected ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={w.connected ? colors.success : colors.textTertiary}
              />
            </View>
          ))}
          <Pressable onPress={() => router.push("/life" as any)} style={styles.upcomingLink}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <AppText variant="footnote" color="brand" style={styles.linkLabel}>
              {c.upcomingCount > 0
                ? `Tracking ${c.upcomingCount} upcoming event${c.upcomingCount === 1 ? "" : "s"} →`
                : "Nothing on your horizon yet →"}
            </AppText>
          </Pressable>
        </Card>
      ) : null}

      <ConsentGroupCard title="Core" rows={core} onToggle={c.toggle} />
      <ConsentGroupCard title="Senses" rows={integrations} onToggle={c.toggle} />
      <NotificationsCard notif={notif} />
      <ConsentGroupCard title="Not collected yet" rows={future} onToggle={c.toggle} />

      <AppText variant="caption" color="tertiary" align="center" style={styles.footnote}>
        Some senses need the full app build to grant device permission. Until then they stay
        off and the app works exactly the same.
      </AppText>
    </Screen>
  );
}

function ConsentGroupCard({
  title,
  rows,
  onToggle,
}: {
  title: string;
  rows: ConsentRow[];
  onToggle: (category: ConsentRow["category"], granted: boolean) => Promise<void>;
}) {
  const { colors } = useColors();
  if (rows.length === 0) return null;
  return (
    <Card style={styles.block} padding="lg">
      <AppText variant="caption" color="tertiary" uppercase style={styles.kicker}>
        {title}
      </AppText>
      {rows.map((row, i) => (
        <View key={row.category}>
          {i > 0 ? (
            <View style={[styles.divider, { backgroundColor: alpha(colors.text, 0.08) }]} />
          ) : null}
          <View style={styles.consentRow}>
            <IconBadge name={row.icon as any} tone={colors.primary} size={40} />
            <View style={styles.flex}>
              <AppText variant="callout">{row.label}</AppText>
              <AppText variant="footnote" color="tertiary" style={styles.consentBlurb}>
                {row.blurb}
              </AppText>
            </View>
            <Switch
              value={row.granted}
              disabled={row.disabled}
              onValueChange={(v) => onToggle(row.category, v)}
              trackColor={{ true: colors.primary, false: alpha(colors.text, 0.18) }}
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Proactive notifications — its own card because enabling drives the OS permission prompt. */
function NotificationsCard({ notif }: { notif: UseNotificationSettings }) {
  const { colors } = useColors();
  const unavailable = notif.status?.permission === "unavailable";
  const on = !!notif.prefs?.enabled;
  const budget = notif.prefs?.dailyBudget ?? 3;

  return (
    <Card style={styles.block} padding="lg">
      <AppText variant="caption" color="tertiary" uppercase style={styles.kicker}>
        Reach
      </AppText>

      <View style={styles.consentRow}>
        <IconBadge name="notifications" tone={colors.primary} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">Proactive notifications</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.consentBlurb}>
            {unavailable
              ? "Available in the full app build. A daily briefing and timely nudges, within quiet hours."
              : "A daily briefing and timely nudges — within your quiet hours and a gentle daily limit."}
          </AppText>
        </View>
        <Switch
          value={on}
          disabled={unavailable || notif.loading}
          onValueChange={(v) => (v ? notif.enable() : notif.disable())}
          trackColor={{ true: colors.primary, false: alpha(colors.text, 0.18) }}
        />
      </View>

      {on && notif.prefs ? (
        <>
          <View style={[styles.divider, { backgroundColor: alpha(colors.text, 0.08) }]} />
          <View style={styles.prefRow}>
            <AppText variant="footnote" color="secondary">
              Quiet hours
            </AppText>
            <AppText variant="footnote">
              {notif.prefs.quietStart} – {notif.prefs.quietEnd}
            </AppText>
          </View>
          <View style={styles.prefRow}>
            <AppText variant="footnote" color="secondary">
              Most per day
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                hitSlop={8}
                onPress={() => notif.setDailyBudget(Math.max(1, budget - 1))}
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <AppText variant="callout" style={styles.stepValue}>
                {budget}
              </AppText>
              <Pressable
                hitSlop={8}
                onPress={() => notif.setDailyBudget(Math.min(6, budget + 1))}
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center" },
  intro: { marginBottom: Spacing.lg },
  block: { marginBottom: Spacing.md },
  flex: { flex: 1 },
  kicker: { marginBottom: Spacing.md },
  watchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  upcomingLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.2)",
  },
  linkLabel: { fontWeight: "700" },
  consentRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  consentBlurb: { marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 18, textAlign: "center" },
  footnote: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
});
