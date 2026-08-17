/**
 * WHAT'S COMING UP — the standalone Life Context screen (P0 of the Proactive
 * Companion). Where you tell Gozlin about the future it should coach around: a
 * wedding, a surgery, an exam season, a trip, a medication course. Each entry is
 * forward-dated and auto-expires after it passes (the day-rollover sweep in
 * AppContext). See docs/companion/00-proactive-companion-blueprint.md §3.1.
 *
 * THE HORIZON'S HOME IS NOW `/knows`, which renders exactly these panels inline
 * as its "What's ahead" section. This route survives because two live entry
 * points push straight at it and must land somewhere focused: the Privacy
 * screen's "tracking N upcoming events" link, and Gozlin's own notifications
 * (`GozlinNotificationPlanner` routes to `/life`) — which cold-start the app, so
 * the destination has to stand on its own.
 *
 * Every panel below is imported, not defined. `components/lifecontext/LifePanels`
 * is the single definition, so this screen and /knows cannot drift apart.
 */
import {
  AddSheet,
  AnticipationSection,
  SignalsPanel,
  UpcomingCard,
  presetTitleFor,
  useAnticipation,
  useLifeContext,
  type AddPreset,
} from "@/components/lifecontext";
import { AppText, Button, Card, IconBadge, Screen, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { Anticipation } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

export default function LifeScreen() {
  const { colors } = useColors();
  const lc = useLifeContext();
  const ant = useAnticipation();
  const [addPreset, setAddPreset] = useState<AddPreset | null>(null);

  const onCta = (a: Anticipation) => {
    if (a.addKind) setAddPreset({ kind: a.addKind, title: presetTitleFor(a.addKind) });
    else router.push("/gozlin" as never);
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.iconBtn}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        What&apos;s coming up
      </AppText>
      <Pressable
        onPress={() => router.push("/knows" as never)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Memory"
        style={styles.iconBtn}
      >
        <Ionicons name="planet-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  return (
    <>
      <Screen header={header}>
        <AppText variant="subhead" color="secondary" style={styles.intro}>
          Tell Gozlin what&apos;s ahead and your plan bends around it — before it arrives.
        </AppText>

        <AnticipationSection ant={ant} onCta={onCta} />

        <SignalsPanel onSynced={() => Promise.all([lc.reload(), ant.reload()]).then(() => {})} />

        <View style={styles.list}>
          {lc.loading ? (
            <Card>
              <AppText color="tertiary">Loading…</AppText>
            </Card>
          ) : lc.rows.length === 0 ? (
            <Card padding="xxl">
              <View style={styles.empty}>
                <IconBadge name="calendar-outline" tone={colors.primary} size={52} />
                <AppText variant="headline" align="center" style={styles.emptyTitle}>
                  Nothing on the horizon yet
                </AppText>
                <AppText variant="subhead" color="tertiary" align="center">
                  Add a trip, a wedding, an exam season or a medication course and Gozlin
                  will start planning around it.
                </AppText>
              </View>
            </Card>
          ) : (
            lc.rows.map((row) => (
              <UpcomingCard
                key={row.id}
                row={row}
                onComplete={async () => {
                  await lc.complete(row.id);
                  await ant.reload();
                }}
                onDismiss={() =>
                  Alert.alert(row.title, "Remove this from your horizon?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: async () => {
                        await lc.dismiss(row.id);
                        await ant.reload();
                      },
                    },
                  ])
                }
              />
            ))
          )}
        </View>

        <Button
          label="Add something coming up"
          icon="add"
          variant="tonal"
          onPress={() => setAddPreset({})}
        />
      </Screen>

      <AddSheet
        visible={addPreset !== null}
        presetKind={addPreset?.kind}
        presetTitle={addPreset?.title}
        onClose={() => setAddPreset(null)}
        onSave={async (input) => {
          await lc.add(input);
          await ant.reload();
          setAddPreset(null);
        }}
      />
    </>
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
  list: { marginTop: Spacing.md, marginBottom: Spacing.md },
  empty: { alignItems: "center", gap: Spacing.sm },
  emptyTitle: { marginTop: Spacing.sm },
});
