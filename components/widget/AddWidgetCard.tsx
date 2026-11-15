/**
 * AddWidgetCard — "put welliva on your home screen", one tap (Settings).
 *
 * Owner, 2026-11-15: "let the app invite users to add the app widget to their
 * home screen through a click in settings — just as in Duolingo". Android's own
 * pin request opens the launcher's "Add to home screen?" prompt; she decides
 * there. Coming back to the app re-checks, so the card says "on your home
 * screen" only when a widget really is placed. A launcher that can't add widgets
 * for an app gets the three steps instead of a button that does nothing.
 *
 * Renders nothing where there is no widget: iPhone, or a build without it.
 */
import { AppText, Button, Card, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Image, StyleSheet, View } from "react-native";

import { askToAddTodayWidget, todayWidgetAvailable, todayWidgetPlaced } from "@/widgets";

const PREVIEW = require("@/assets/widget/today-preview.png");

export function AddWidgetCard() {
  const { colors } = useColors();
  const available = todayWidgetAvailable();
  const [placed, setPlaced] = useState<boolean | null>(null);
  const [manual, setManual] = useState(false);
  const [asking, setAsking] = useState(false);

  const check = useCallback(() => {
    void todayWidgetPlaced().then(setPlaced);
  }, []);

  useEffect(() => {
    if (!available) return;
    check();
    // The launcher's prompt is outside the app; its answer shows on return.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [available, check]);

  const add = useCallback(async () => {
    if (asking) return;
    setAsking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const result = await askToAddTodayWidget();
      setManual(result === "manual");
      // Some launchers add it without leaving the app: look again shortly.
      setTimeout(check, 1500);
    } finally {
      setAsking(false);
    }
  }, [asking, check]);

  if (!available) return null;

  return (
    <Card padding="lg">
      <View style={styles.row}>
        <Image
          source={PREVIEW}
          style={styles.preview}
          resizeMode="contain"
          accessibilityLabel="The welliva widget: one word for your day and a line of light"
        />
        <View style={styles.flex}>
          <AppText variant="callout" weight="700">
            Your day on the home screen
          </AppText>
          <AppText variant="footnote" color="secondary" style={styles.line}>
            One word for how today is going, and a line of light — no app to open.
          </AppText>
        </View>
      </View>

      {placed ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <AppText variant="footnote" color="secondary">
            It&apos;s on your home screen.
          </AppText>
        </View>
      ) : manual ? (
        <AppText variant="footnote" color="secondary" style={styles.steps}>
          {"This phone adds widgets by hand: touch and hold an empty spot on your home screen, " +
            "choose Widgets (or Shortcuts), find welliva, and drag it into place."}
        </AppText>
      ) : (
        <Button
          label={asking ? "Opening…" : "Add widget"}
          icon="add-circle"
          onPress={() => void add()}
          disabled={asking}
          style={styles.button}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  flex: { flex: 1 },
  preview: { width: 112, height: 64, borderRadius: Radius.md },
  line: { marginTop: 2 },
  done: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  steps: { marginTop: Spacing.md },
  button: { marginTop: Spacing.md },
});
