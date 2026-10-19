/**
 * PickDateSheet — "which day?", for the moments one tap on today isn't right:
 * a period that started yesterday, one that ended a few days ago, or the one
 * she forgot to log between two others.
 */
import { AppText, Button, Sheet } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { daysBetween } from "@/services/cycle";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DateStrip } from "./DateStrip";

export interface PickDateSheetProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  today: string;
  /** Newest day offered. Defaults to today. */
  latest?: string;
  /** Oldest day offered. Defaults to 60 days before `latest`. */
  earliest?: string;
  initial?: string | null;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export function PickDateSheet({
  visible,
  title,
  body,
  confirmLabel,
  today,
  latest,
  earliest,
  initial,
  onConfirm,
  onClose,
}: PickDateSheetProps) {
  const newest = latest ?? today;
  const [value, setValue] = useState<string | null>(initial ?? newest);
  useEffect(() => {
    if (visible) setValue(initial ?? newest);
  }, [visible, initial, newest]);
  const span = earliest ? daysBetween(earliest, newest) + 1 : 60;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          {body ? (
            <AppText variant="footnote" color="tertiary">
              {body}
            </AppText>
          ) : null}
        </View>
      }
    >
      <View style={styles.body}>
        <DateStrip
          today={newest}
          relative={newest === today}
          days={Math.max(1, span)}
          earliest={earliest}
          value={value}
          onChange={setValue}
        />
        <Button
          label={confirmLabel}
          onPress={() => {
            if (!value) return;
            onConfirm(value);
            onClose();
          }}
          disabled={!value}
          fullWidth
          style={styles.cta}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 2 },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  cta: { marginTop: Spacing.xl },
});
