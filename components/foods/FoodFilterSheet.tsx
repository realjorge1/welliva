/**
 * FoodFilterSheet — the full filter set, grouped.
 *
 * Nineteen filters do not go in a horizontal chip scroller. Four of them live on
 * the screen as quick chips (the ones people reach for constantly) and the rest
 * are here, grouped and labelled, behind one button carrying a count.
 *
 * Every row states its actual RULE under the name. "Low fat" is a legal claim
 * with a defined threshold, and a filter that silently applies its own numbers
 * teaches the user something false about their food. The description is also the
 * accessibility hint, so the rule is available whether you can read the small
 * grey line or not.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button, useColors } from "@/components/ui";
import {
  FILTERS_BY_GROUP,
  FILTER_GROUP_LABEL,
  type FoodFilter,
} from "@/constants/foodFilters";
import { Radius, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";

export interface FoodFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  active: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  /**
   * How many foods the current selection leaves — shown on the apply button,
   * but only once something is actually selected. With nothing on, that number
   * is just the size of the bundled catalog, and printing it would understate
   * the screen: it can also reach the user's own foods and the USDA/AI lookup.
   */
  resultCount: number;
}

export function FoodFilterSheet({
  visible,
  onClose,
  active,
  onToggle,
  onClear,
  resultCount,
}: FoodFilterSheetProps) {
  const { colors } = useColors();
  // A Modal renders outside the Screen's SafeAreaView, so it inherits no top
  // inset of its own. Same clamp as FoodDetailSheet — see the note there.
  const insets = useSafeAreaInsets();
  const headerTop = Math.max(Spacing.lg, Math.min(insets.top, 24) + Spacing.sm);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View
          style={[styles.header, { borderBottomColor: colors.border, paddingTop: headerTop }]}
        >
          <View style={styles.headerText}>
            <AppText variant="headline" weight="700">
              Filters
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {active.size === 0
                ? "Showing every food"
                : `${active.size} active · ${resultCount} food${resultCount === 1 ? "" : "s"}`}
            </AppText>
          </View>

          {active.size > 0 ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClear();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <AppText variant="footnote" weight="700" color="brand">
                Clear
              </AppText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {FILTERS_BY_GROUP.map(({ group, filters }) => (
            <View key={group} style={styles.group}>
              <AppText
                variant="caption"
                color="tertiary"
                uppercase
                weight="700"
                style={styles.groupLabel}
              >
                {FILTER_GROUP_LABEL[group]}
              </AppText>

              <View
                style={[
                  styles.groupBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {filters.map((f, i) => (
                  <FilterRow
                    key={f.key}
                    filter={f}
                    checked={active.has(f.key)}
                    onPress={() => onToggle(f.key)}
                    style={
                      i > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          ))}

          <AppText variant="caption" color="tertiary" style={styles.footnote}>
            Diet and allergen filters read the food itself, not how a dish was
            prepared or packaged. They&apos;re here to tidy a long list — always
            read the label on anything packaged.
          </AppText>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Button
            label={
              resultCount === 0
                ? "No foods match"
                : active.size === 0
                  ? "Show foods"
                  : `Show ${resultCount} food${resultCount === 1 ? "" : "s"}`
            }
            fullWidth
            size="md"
            onPress={onClose}
            disabled={resultCount === 0}
          />
        </View>
      </View>
    </Modal>
  );
}

function FilterRow({
  filter,
  checked,
  onPress,
  style,
}: {
  filter: FoodFilter;
  checked: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={filter.label}
      accessibilityHint={filter.description}
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.row, style, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowText}>
        <AppText variant="callout" weight={checked ? "700" : "400"}>
          {filter.label}
        </AppText>
        <AppText variant="caption" color="tertiary" style={styles.rowRule}>
          {filter.description}
        </AppText>
      </View>

      <View
        style={[
          styles.check,
          {
            backgroundColor: checked ? colors.primary : "transparent",
            borderColor: checked ? colors.primary : colors.borderStrong,
          },
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** The trigger that opens the sheet, with a count badge. */
export function FilterButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const on = count > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        on ? `Filters, ${count} active` : "Filters"
      }
      accessibilityHint="Opens the full list of filters"
      style={[
        styles.filterBtn,
        {
          backgroundColor: on ? colors.primary : alpha(colors.text, 0.06),
          borderColor: on ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name="options-outline"
        size={14}
        color={on ? colors.onPrimary : colors.textSecondary}
      />
      <AppText
        variant="footnote"
        weight="700"
        style={{ color: on ? colors.onPrimary : colors.textSecondary }}
      >
        {on ? `Filters · ${count}` : "All filters"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.giant },
  group: { marginBottom: Spacing.xl },
  groupLabel: { marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  groupBox: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rowText: { flex: 1, gap: 2 },
  rowRule: { lineHeight: 15 },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { lineHeight: 16, marginTop: Spacing.xs },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
});
