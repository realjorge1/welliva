/**
 * TemperatureInput — one resting temperature, typed in her unit, stored in °C.
 *
 * Saved when she finishes typing (the keyboard's done key or leaving the
 * field), like every other row in the day sheet saves on the tap. A reading
 * outside a thermometer's range is refused with a line saying why, never
 * stored. An empty field clears the day's reading.
 *
 * Shown only with the fertile window on, and only once temperature logging is
 * switched on (services/cycle/bbt TEMPERATURE_LOGGING).
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { cToF, fToC, normalizeTemperatureC, TEMPERATURE_RANGE_C } from "@/services/cycle";
import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

export interface TemperatureInputProps {
  valueC: number | null;
  unit: "C" | "F";
  onChange: (celsius: number | null) => void;
}

const shown = (c: number | null, unit: "C" | "F") =>
  c === null ? "" : unit === "F" ? cToF(c).toFixed(1) : c.toFixed(2);

export function TemperatureInput({ valueC, unit, onChange }: TemperatureInputProps) {
  const { colors } = useColors();
  const [text, setText] = useState(shown(valueC, unit));
  const [refused, setRefused] = useState(false);

  const commit = () => {
    const raw = text.trim().replace(",", ".");
    if (!raw) {
      setRefused(false);
      if (valueC !== null) onChange(null);
      return;
    }
    const n = Number(raw);
    const c = Number.isFinite(n) ? normalizeTemperatureC(unit === "F" ? fToC(n) : n) : null;
    if (c === null) {
      setRefused(true);
      return;
    }
    setRefused(false);
    setText(shown(c, unit));
    if (c !== valueC) onChange(c);
  };

  const range =
    unit === "F"
      ? `${cToF(TEMPERATURE_RANGE_C.min).toFixed(0)}–${cToF(TEMPERATURE_RANGE_C.max).toFixed(0)} °F`
      : `${TEMPERATURE_RANGE_C.min}–${TEMPERATURE_RANGE_C.max} °C`;

  return (
    <View>
      <View style={[styles.field, { backgroundColor: alpha(colors.text, 0.05) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={commit}
          onSubmitEditing={commit}
          placeholder={unit === "F" ? "97.9" : "36.60"}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel={`Temperature on waking, in degrees ${unit === "F" ? "Fahrenheit" : "Celsius"}`}
          style={[styles.input, { color: colors.text }]}
        />
        <AppText variant="callout" color="tertiary">
          {unit === "F" ? "°F" : "°C"}
        </AppText>
      </View>
      {refused ? (
        <AppText variant="footnote" color="secondary" style={styles.refused}>
          That doesn&apos;t look like a body temperature ({range}). Not saved.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: Spacing.md },
  refused: { marginTop: Spacing.xs },
});
