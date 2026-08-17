/**
 * TRUST — the consent boundary, made visible and revocable.
 *
 * It answers one question: *what is Welliva allowed to see, and what is it allowed
 * to do about it?* Every external sense and every route out of the phone is listed
 * with a plain-language blurb and a switch the user owns. Turning one off makes its
 * native reads a no-op end-to-end — the Signal adapters are consent-gated, so these
 * are the real levers, not a settings-shaped promise.
 *
 * THE NAME IS THE FRAME. This was "What Gozlin watches", which put the one screen
 * meant to *lower* anxiety in the vocabulary of surveillance — and in the third
 * person, while every consent blurb underneath it is written in Gozlin's own first
 * person. "Trust" is a noun like every other row in the menu, and it points at what
 * the user is granting rather than at what the machine is doing.
 *
 * THREE GROUPS, NOT FIVE. Senses (what comes in), Reach (what goes out), and a
 * single honest line for what isn't collected at all. `local_processing` used to
 * render as a Switch that could never move — a permanently-disabled control reads
 * as a bug, not a guarantee — so it is the promise card at the top instead. The
 * legal documents live here rather than in Settings: they are the promise, these
 * switches are the enforcement, and splitting the pair across two screens is what
 * made both copies feel like filler.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §6.
 */
import { AppText, Card, IconBadge, Screen, useColors } from "@/components/ui";
import { ScreenTopBar } from "@/components/navigation";
import { useConsent, type ConsentRow } from "@/components/privacy/useConsent";
import { useLegalGate } from "@/components/legal";
import { LEGAL_DOCS, LEGAL_DOC_ORDER, LEGAL_VERSION } from "@/constants/legal";
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
  const { acceptance } = useLegalGate();

  const header = <ScreenTopBar title="Trust" style={styles.headerRow} />;

  /** The always-on guarantee. Shown as a statement — it was never a choice. */
  const onDevice = c.rows.find((r) => r.category === "local_processing");
  /** Cloud AI sits with Reach, not with "core": it is data leaving the phone. */
  const cloudAi = c.rows.find((r) => r.category === "ai_cloud");
  // proactive_notifications has its own card (it needs the OS-permission flow, not just a flip).
  const senses = c.rows.filter(
    (r) => r.group === "integration" && r.category !== "proactive_notifications",
  );
  const future = c.rows.filter((r) => r.group === "future");

  return (
    <Screen header={header}>
      <AppText variant="subhead" color="secondary" style={styles.intro}>
        You decide what I can see, and what I can do about it. Everything below is off
        until you switch it on, and switching it back off stops it the same second.
      </AppText>

      {/* The guarantee that isn't a setting. */}
      {onDevice ? (
        <Card style={styles.block} padding="lg">
          <View style={styles.promiseRow}>
            <IconBadge name={onDevice.icon as never} tone={colors.success} size={44} solid />
            <View style={styles.flex}>
              <AppText variant="callout">{onDevice.label}</AppText>
              <AppText variant="footnote" color="tertiary" style={styles.consentBlurb}>
                {onDevice.blurb}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

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
          <Pressable
            onPress={() => router.push("/life" as any)}
            style={styles.upcomingLink}
            accessibilityRole="button"
            accessibilityLabel={
              c.upcomingCount > 0
                ? `Tracking ${c.upcomingCount} upcoming event${c.upcomingCount === 1 ? "" : "s"}. Open your horizon`
                : "Nothing on your horizon yet. Open your horizon"
            }
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <AppText variant="footnote" color="brand" style={styles.linkLabel}>
              {c.upcomingCount > 0
                ? `Tracking ${c.upcomingCount} upcoming event${c.upcomingCount === 1 ? "" : "s"} →`
                : "Nothing on your horizon yet →"}
            </AppText>
          </Pressable>
        </Card>
      ) : null}

      {/* What comes in. */}
      <ConsentGroupCard title="Senses" rows={senses} onToggle={c.toggle} />

      {/* What goes out — cloud chat and out-of-app reach are the same question. */}
      <ReachCard notif={notif} cloudAi={cloudAi} onToggle={c.toggle} />

      {/* One line, not a card of switches nobody can move. */}
      {future.length > 0 ? (
        <AppText variant="footnote" color="tertiary" style={styles.futureLine}>
          Not collected at all:{" "}
          {future.map((r) => r.label.toLowerCase()).join(" and ")}. Neither is built yet —
          both are named here so this list stays complete rather than flattering.
        </AppText>
      ) : null}

      {/* The switches above are the enforcement. These are the promise. */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.groupKicker}>
        Our promises
      </AppText>
      <Card style={styles.block} padding="none">
        {LEGAL_DOC_ORDER.map((id, i) => {
          const doc = LEGAL_DOCS[id];
          return (
            <Pressable
              key={id}
              onPress={() => router.push(`/legal/${id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Read ${doc.title}`}
              style={[
                styles.docRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: alpha(colors.text, 0.08),
                },
              ]}
            >
              <IconBadge
                name={doc.icon as never}
                tone={id === "disclaimer" ? colors.warning : colors.primary}
                size={38}
              />
              <View style={styles.flex}>
                <AppText variant="callout">{doc.title}</AppText>
                <AppText variant="caption" color="tertiary" style={styles.consentBlurb}>
                  {doc.summary}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          );
        })}
      </Card>

      {/* Which version you actually agreed to, and when. */}
      <AppText variant="caption" color="tertiary" align="center" style={styles.footnote}>
        {acceptance
          ? `You accepted version ${acceptance.version} on ${new Date(
              acceptance.acceptedAt,
            ).toLocaleDateString()}.`
          : `Version ${LEGAL_VERSION}.`}{" "}
        Switching a sense on asks your phone for permission too — until you grant it
        there, it stays off and nothing changes.
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

/**
 * REACH — everything that leaves the phone, in one place. Cloud chat and proactive
 * notifications used to sit in separate cards labelled "Core" and "Reach", which
 * asked the user to hold an engineering distinction ("processing" vs "out-of-app")
 * that has no meaning to them. The question they actually have is the same for
 * both: does anything go out, and can I stop it?
 *
 * Notifications keep their own row treatment because enabling drives the OS prompt
 * and unlocks the quiet-hours and daily-limit controls beneath it.
 */
function ReachCard({
  notif,
  cloudAi,
  onToggle,
}: {
  notif: UseNotificationSettings;
  cloudAi?: ConsentRow;
  onToggle: (category: ConsentRow["category"], granted: boolean) => Promise<void>;
}) {
  const { colors } = useColors();
  const unavailable = notif.status?.permission === "unavailable";
  const on = !!notif.prefs?.enabled;
  const budget = notif.prefs?.dailyBudget ?? 3;

  return (
    <Card style={styles.block} padding="lg">
      <AppText variant="caption" color="tertiary" uppercase style={styles.kicker}>
        Reach
      </AppText>

      {cloudAi ? (
        <>
          <View style={styles.consentRow}>
            <IconBadge name={cloudAi.icon as never} tone={colors.primary} size={40} />
            <View style={styles.flex}>
              <AppText variant="callout">{cloudAi.label}</AppText>
              <AppText variant="footnote" color="tertiary" style={styles.consentBlurb}>
                {cloudAi.blurb}
              </AppText>
            </View>
            <Switch
              value={cloudAi.granted}
              disabled={cloudAi.disabled}
              onValueChange={(v) => onToggle(cloudAi.category, v)}
              trackColor={{ true: colors.primary, false: alpha(colors.text, 0.18) }}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: alpha(colors.text, 0.08) }]} />
        </>
      ) : null}

      <View style={styles.consentRow}>
        <IconBadge name="notifications" tone={colors.primary} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">Proactive notifications</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.consentBlurb}>
            {unavailable
              ? "Not available on this device. A daily briefing and timely nudges, within quiet hours."
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
                accessibilityRole="button"
                accessibilityLabel="Fewer notifications per day"
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
                accessibilityRole="button"
                accessibilityLabel="More notifications per day"
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
  headerRow: { paddingVertical: Spacing.sm },
  intro: { marginBottom: Spacing.lg },
  block: { marginBottom: Spacing.md },
  flex: { flex: 1 },
  kicker: { marginBottom: Spacing.md },
  groupKicker: { marginBottom: Spacing.md, marginTop: Spacing.sm },
  promiseRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  futureLine: { marginBottom: Spacing.lg, marginTop: Spacing.xs },
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
  docRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
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
