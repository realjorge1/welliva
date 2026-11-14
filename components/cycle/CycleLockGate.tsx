/**
 * CycleLockGate — what every cycle screen shows while "Lock my cycle" is on.
 *
 * Wraps each cycle route (/cycle, /cycle/setup, /cycle/settings and the
 * library, whose pages carry the doctor-summary share button). The decisions
 * are services/cycle/lockRules; the state is contexts/CycleLockContext.
 *
 *   locked  — a calm screen: a lock, one line, an Unlock button. The phone's
 *             own prompt opens by itself ONCE per opening (a new visit, or a
 *             fresh lock while she stays here). A cancel never brings it back
 *             by itself: that would be a loop she can't get out of.
 *   pending — the beat at start-up before the phone has said what it can ask
 *             for: nothing about the cycle, and no prompt.
 *   open    — the screen itself. With the lock on, a plain cover goes over it
 *             as the app leaves the foreground, for the recent-apps preview.
 *             (iOS takes that picture after "inactive", so the cover is in
 *             time. Android may take it before the cover is drawn: see
 *             docs/cycle/smart-cycle.md.)
 *
 * Nothing here names a period, a symptom or a phase.
 */
import { ScreenTopBar } from "@/components/navigation";
import { AppText, Button, IconBadge, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycleLockOptional, type CycleLockValue } from "@/contexts/CycleLockContext";
import { openingKey } from "@/services/cycle/lockRules";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCyclePalette } from "./cycleTheme";

/** A beat after the screen lands, so she sees where she is before the phone asks. */
const AUTO_PROMPT_DELAY_MS = 350;

export interface CycleLockGateProps {
  /** "tab": the menu's own top bar. "pushed": a back arrow. */
  variant: "tab" | "pushed";
  children: React.ReactNode;
}

export function CycleLockGate({ variant, children }: CycleLockGateProps) {
  const lock = useCycleLockOptional();
  const away = useAway(!!lock?.enabled);
  if (!lock) return <>{children}</>;

  if (lock.gate === "locked" || lock.gate === "pending") {
    return <LockedScreen variant={variant} lock={lock} />;
  }

  return (
    <View style={styles.fill}>
      {children}
      {lock.released ? <ReleasedNote line={lock.released} onDone={lock.clearReleased} /> : null}
      {away && lock.enabled ? <Cover /> : null}
    </View>
  );
}

/** True while the app is not in front (iOS "inactive" included): the moment the preview is taken. */
function useAway(watching: boolean): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!watching) {
      setAway(false);
      return;
    }
    const sub = AppState.addEventListener("change", (state) => setAway(state !== "active"));
    return () => sub.remove();
  }, [watching]);
  return away;
}

function LockedScreen({ variant, lock }: { variant: "tab" | "pushed"; lock: CycleLockValue }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const locked = lock.gate === "locked";
  const { unlock, epoch, prompting } = lock;

  // Each focus is an opening; so is a fresh lock while she stays on screen.
  const [focus, setFocus] = useState(0);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setFocus((n) => n + 1);
      return () => {
        focused.current = false;
      };
    }, []),
  );

  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!locked || prompting || focus === 0) return;
    const key = openingKey(focus, epoch);
    if (asked.current === key) return;
    const t = setTimeout(() => {
      if (!focused.current || AppState.currentState !== "active") return;
      asked.current = key;
      void unlock();
    }, AUTO_PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, [locked, prompting, focus, epoch, unlock]);

  const header =
    variant === "tab" ? (
      <ScreenTopBar title="Cycle" style={styles.topBar} />
    ) : (
      <View style={styles.headerRow}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
      </View>
    );

  return (
    <Screen header={header} floatingHeader={variant === "tab"} scroll={false}>
      <View style={styles.center}>
        <IconBadge name="lock-closed" tone={palette.period} size={56} />
        {locked ? (
          <>
            <AppText variant="title" align="center" style={styles.title}>
              Your cycle is locked
            </AppText>
            <AppText variant="body" color="secondary" align="center">
              {lock.copy.unlockWith}
            </AppText>
            {lock.failure ? (
              <AppText variant="footnote" color="secondary" align="center" style={styles.failure}>
                {lock.failure}
              </AppText>
            ) : null}
            <Button
              label="Unlock"
              icon="lock-open-outline"
              onPress={() => void unlock()}
              disabled={prompting}
              fullWidth={false}
              style={styles.unlock}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

/** The lock switched itself off: said once, over the screen it let her into. */
function ReleasedNote({ line, onDone }: { line: string; onDone: () => void }) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.note,
        { bottom: insets.bottom + Spacing.xl, backgroundColor: colors.surface, borderColor: colors.divider },
      ]}
    >
      <Ionicons name="lock-open-outline" size={18} color={colors.textSecondary} />
      <AppText variant="footnote" style={styles.flex}>
        {line}
      </AppText>
      <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button" accessibilityLabel="OK">
        <AppText variant="footnote" weight="700" color="brand">
          OK
        </AppText>
      </Pressable>
    </View>
  );
}

/** A plain page over the screen while the app is away, for the recent-apps preview. */
function Cover() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.background }]} pointerEvents="none">
      <IconBadge name="lock-closed" tone={palette.period} size={56} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  topBar: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  title: { marginTop: Spacing.lg },
  failure: { marginTop: Spacing.sm },
  unlock: { marginTop: Spacing.xl, minWidth: 160 },
  note: {
    position: "absolute",
    left: Spacing.screen,
    right: Spacing.screen,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { alignItems: "center", justifyContent: "center" },
});
