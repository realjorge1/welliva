/**
 * "LET GOZLIN SEE YOUR CYCLE?" — asked once, on a day the answer matters.
 *
 * Consent `cycle_gozlin` is off by default and nothing ever surfaced it, so the
 * coach was blind to her cycle for everyone who never went hunting through Cycle
 * settings. For a paying user that is the feature at its worst: she is paying
 * for a coach that knows nothing about the one thing shaping her day.
 *
 * WHEN it appears, and when it gives up, is entirely services/cycle/brief's
 * `gozlinAsk` — pure, tested, and the same predicate wherever this card is
 * mounted. This file is the card and nothing else.
 *
 * TWO FACES, ONE QUESTION. The question is the same for everyone, because the
 * permission is worth having in place either way — which is exactly what the
 * Settings toggle has always said. What changes is the second button: a Pro
 * user is offered the coach she has, and everyone else is offered a look at
 * what Gozlin is, instead of being dropped into a locked screen.
 *
 * THE BUDGET IS SPENT HERE. The card tells the provider it appeared, once per
 * day, so an ask that is never answered can stop coming back — scrolling past a
 * card is not declining it, and three days is where it ends (GOZLIN_ASK_LIMIT).
 * The write is idempotent per day and the card renders the same whether or not
 * it lands, so a failed write costs nothing but one more chance.
 */
import { AppText, Button, Card, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useBilling } from "@/contexts/BillingContext";
import { useCycle } from "@/contexts/CycleContext";
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

export function CycleGozlinAsk({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const { allows, openUpgrade } = useBilling();
  const ask = cycle.gozlinAsk;
  const [accepted, setAccepted] = useState(false);

  // Counted once per appearance, not once per render. The ref is what keeps a
  // re-render (a scroll, a theme change, the day's log being edited) from
  // spending the whole budget in one sitting.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!ask) return;
    if (counted.current === cycle.today) return;
    counted.current = cycle.today;
    void cycle.noteGozlinAsk();
  }, [ask, cycle]);

  const canCoach = allows("coach-limit");

  const accept = async () => {
    await cycle.setShareWithGozlin(true);
    setAccepted(true);
    // Straight to the thing she just gave permission for. A "done" toast would
    // leave her to go and find the coach herself, which is how a yes becomes a
    // setting nobody uses. Someone without the coach has nowhere to be taken,
    // so she gets the confirmation below instead of a paywall for an answer.
    if (canCoach) router.navigate("/gozlin" as never);
  };

  /**
   * THE YES IS ANSWERED IN PLACE. Granting consent makes `gozlinAsk` return
   * null, so without this the card would simply blink out of existence — the
   * one outcome that looks identical to a tap that did nothing.
   *
   * The confirmation is gated on `shareWithGozlin` actually being true rather
   * than on the attempt: `setShareWithGozlin` rolls its own state back when the
   * write fails, so a failed yes falls through to the ask again instead of
   * claiming something that isn't so.
   */
  const confirmed = accepted && cycle.shareWithGozlin;
  if (confirmed) {
    return (
      <Card style={style} padding="lg">
        <View style={styles.head}>
          <View style={[styles.markSlot, { backgroundColor: alpha(colors.primary, 0.1) }]}>
            <Ionicons name="checkmark" size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="callout">Gozlin can see your cycle</AppText>
            <AppText variant="footnote" color="secondary" style={styles.body}>
              {canCoach
                ? "Ask it anything and it knows the day you're on. You can switch this off any time in Cycle settings."
                : "Gozlin is part of welliva Pro, so this is simply ready for whenever you are. You can switch it off any time in Cycle settings."}
            </AppText>
          </View>
        </View>
      </Card>
    );
  }

  if (!ask) return null;

  return (
    <Card style={style} padding="lg">
      <View style={styles.head}>
        {/* Gozlin's own mark, in its own colours — never tinted. */}
        <View style={[styles.markSlot, { backgroundColor: alpha(colors.primary, 0.1) }]}>
          <AILogoIcon size={26} />
        </View>
        <View style={styles.flex}>
          <AppText variant="callout">{ask.headline}</AppText>
          <AppText variant="footnote" color="secondary" style={styles.body}>
            {ask.detail}
          </AppText>
        </View>
      </View>

      <View style={[styles.privacy, { backgroundColor: palette.wash }]}>
        <Ionicons name="lock-closed-outline" size={13} color={palette.period} />
        <AppText variant="caption" color="secondary" style={styles.flex}>
          Your cycle day, when your next period is likely, and what you logged today. Nothing else,
          and only while you&apos;re chatting.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button
          label={canCoach ? "Let Gozlin see it" : "Turn it on"}
          size="sm"
          onPress={() => void accept()}
          style={styles.flex}
        />
        <Button label="Not now" size="sm" variant="ghost" onPress={() => void cycle.dismissGozlinAsk()} />
      </View>

      {canCoach ? null : (
        <Pressable
          onPress={() => openUpgrade("coach-limit")}
          accessibilityRole="button"
          accessibilityLabel="What is Gozlin?"
          hitSlop={8}
          style={styles.proRow}
        >
          <AppText variant="caption" color="tertiary" style={styles.flex}>
            Gozlin is part of welliva Pro. Turning this on now means it&apos;s ready if you ever do.
          </AppText>
          <AppText variant="caption" color="brand" weight="700">
            What&apos;s Gozlin?
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  markSlot: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { marginTop: 2 },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg, alignItems: "center" },
  proRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
