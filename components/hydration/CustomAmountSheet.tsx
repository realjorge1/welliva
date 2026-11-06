/**
 * CustomAmountSheet — for the drink that is not 150, 250 or 500.
 *
 * A can, a bottle, a big mug: set the amount exactly and add it. The presets
 * are the sizes people really drink, one tap from setting the number; the minus
 * and plus move it a step at a time for the rest. The figure is the same dot
 * matrix as the card behind it, so the sheet reads as the card's own control
 * surface rather than a form that happened to slide up.
 *
 * It opens at a can's worth every time (`CUSTOM_DEFAULT`) rather than
 * remembering the last amount: a sheet that opens on whatever you added an hour
 * ago puts a number in front of you that you did not choose.
 */
import { AppText, Button, DotNumeral, Mono, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  CUSTOM_DEFAULT,
  CUSTOM_MAX,
  CUSTOM_MIN,
  CUSTOM_PRESETS,
  clampCustom,
  stepCustom,
} from "./hydrationLogic";

export function CustomAmountSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (ml: number) => void;
}) {
  const { colors } = useColors();
  const [ml, setMl] = useState(CUSTOM_DEFAULT);
  const [figureW, setFigureW] = useState(0);

  // A fresh amount each time it opens.
  useEffect(() => {
    if (visible) setMl(CUSTOM_DEFAULT);
  }, [visible]);

  const add = () => {
    onAdd(ml);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.head}>
          <AppText variant="headline">Add water</AppText>
          <AppText variant="footnote" color="secondary">
            Pick a size, or set an exact amount.
          </AppText>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.dial}>
          <StepKey
            icon="remove"
            label="Less water"
            disabled={ml <= CUSTOM_MIN}
            onPress={() => setMl((v) => stepCustom(v, -1))}
          />

          {/* Read out as one thing. It is not "adjustable" to a screen reader —
              that role promises increment/decrement actions this figure does not
              have; the two keys beside it are how the amount is changed. */}
          <View
            style={styles.figure}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Amount: ${ml} millilitres`}
            onLayout={(e) => setFigureW(Math.floor(e.nativeEvent.layout.width))}
          >
            {figureW > 0 ? <DotNumeral value={ml} pitch={7} maxWidth={figureW} /> : null}
            <Mono size={11} tracking={0.6} color={colors.textTertiary}>
              MILLILITRES
            </Mono>
          </View>

          <StepKey
            icon="add"
            label="More water"
            disabled={ml >= CUSTOM_MAX}
            onPress={() => setMl((v) => stepCustom(v, 1))}
          />
        </View>

        <View style={styles.presets}>
          {CUSTOM_PRESETS.map((p) => {
            const on = ml === p;
            return (
              <Pressable
                key={p}
                onPress={() => setMl(clampCustom(p))}
                accessibilityRole="button"
                accessibilityLabel={`Set ${p} millilitres`}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.preset,
                  {
                    borderColor: on ? colors.water : colors.border,
                    backgroundColor: on ? alpha(colors.water, 0.16) : "transparent",
                  },
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  variant="callout"
                  weight={on ? "800" : "600"}
                  color={on ? colors.water : colors.text}
                >
                  {p}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Button label={`Add ${ml} ml`} onPress={add} style={styles.cta} />
      </View>
    </Sheet>
  );
}

function StepKey({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.step,
        { borderColor: colors.border, opacity: disabled ? 0.35 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const STEP = 52;

const styles = StyleSheet.create({
  head: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 2 },
  body: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.lg },
  dial: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  figure: { flex: 1, alignItems: "center", gap: Spacing.sm, minHeight: 7 * 7 + 20 },
  step: {
    width: STEP,
    height: STEP,
    borderRadius: STEP / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
  preset: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: { marginTop: Spacing.xs },
  pressed: { opacity: 0.85 },
});
