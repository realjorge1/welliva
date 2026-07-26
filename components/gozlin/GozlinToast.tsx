/**
 * GozlinToast — a lightweight, self-dismissing confirmation banner. Replaces
 * "it happened" alerts: actions like resetting the conversation or clearing
 * memory surface a quiet toast that slides in from the top and fades away,
 * instead of interrupting with an OS dialog.
 *
 * Drive it with the `useToast` helper: `const toast = useToast()` then
 * `toast.show("Memory cleared")`. Render `<GozlinToast controller={toast} />`
 * once near the top of the screen tree.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

interface ToastState {
  message: string;
  icon: IconName;
  tone: "default" | "success";
}

export interface ToastController {
  state: ToastState | null;
  show: (message: string, opts?: { icon?: IconName; tone?: "default" | "success" }) => void;
}

export function useToast(): ToastController {
  const [state, setState] = useState<ToastState | null>(null);
  const show = useCallback<ToastController["show"]>((message, opts) => {
    setState({ message, icon: opts?.icon ?? "checkmark-circle", tone: opts?.tone ?? "success" });
  }, []);
  return { state, show };
}

export function GozlinToast({
  controller,
  topOffset = 0,
}: {
  controller: ToastController;
  topOffset?: number;
}) {
  const { colors } = useColors();
  const { state } = controller;
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 80 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 2200);
    return () => clearTimeout(t);
    // Re-run whenever a new toast is shown (state identity changes each call).
  }, [state, anim]);

  if (!visible || !state) return null;

  const tint = state.tone === "success" ? colors.success : colors.primary;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: topOffset + Spacing.sm,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <Animated.View style={[styles.toast, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Ionicons name={state.icon} size={18} color={tint} />
        <AppText variant="callout" weight="600" numberOfLines={1} style={styles.msg}>
          {state.message}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    maxWidth: "92%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  msg: { flexShrink: 1 },
});
