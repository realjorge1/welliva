/**
 * GozlinToast — a lightweight, self-dismissing confirmation banner. Replaces
 * "it happened" alerts: actions like resetting the conversation or clearing
 * memory surface a quiet toast that slides in from the top and fades away,
 * instead of interrupting with an OS dialog.
 *
 * Drive it with the `useToast` helper: `const toast = useToast()` then
 * `toast.show("Memory cleared")`. Render `<GozlinToast controller={toast} />`
 * once near the top of the screen tree.
 *
 * AN ACTION MAKES IT A CONSENT. "Noted · Undo" (the coach keeping something
 * the person said — docs/gozlin/11 §7.3) is the one write that happens without
 * a confirmation sheet, and this toast is what stands in for one. So a toast
 * with an action stays up long enough to be read and reached (ACTION_MS), and
 * takes touches; a plain one stays out of the way of every touch, as before.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

/** A plain toast. */
const SHOW_MS = 2200;
/** A toast carrying an action — long enough to read it and reach the button. */
const ACTION_MS = 6000;

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  message: string;
  icon: IconName;
  tone: "default" | "success";
  action?: ToastAction;
}

export interface ToastController {
  state: ToastState | null;
  show: (
    message: string,
    opts?: { icon?: IconName; tone?: "default" | "success"; action?: ToastAction },
  ) => void;
}

export function useToast(): ToastController {
  const [state, setState] = useState<ToastState | null>(null);
  const show = useCallback<ToastController["show"]>((message, opts) => {
    setState({
      message,
      icon: opts?.icon ?? "checkmark-circle",
      tone: opts?.tone ?? "success",
      ...(opts?.action ? { action: opts.action } : {}),
    });
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

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [anim]);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 80 }).start();
    const t = setTimeout(hide, state.action ? ACTION_MS : SHOW_MS);
    return () => clearTimeout(t);
    // Re-run whenever a new toast is shown (state identity changes each call).
  }, [state, anim, hide]);

  if (!visible || !state) return null;

  const tint = state.tone === "success" ? colors.success : colors.primary;
  const action = state.action;

  return (
    <Animated.View
      pointerEvents={action ? "box-none" : "none"}
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
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              hide();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          >
            <AppText variant="callout" weight="700" color="brand">
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
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
  action: { marginLeft: Spacing.xs },
});
