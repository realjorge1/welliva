/**
 * LEGAL DOCUMENT — /legal/privacy · /legal/terms · /legal/disclaimer
 *
 * One route for all three: the id comes from the path and the content from
 * constants/legal.ts. Reachable while signed OUT too (the sign-up screen links
 * here), which AuthWrapper allows explicitly — a policy you can only read after
 * agreeing to it isn't a policy.
 */
import { LegalDocumentView } from "@/components/legal";
import { AppText, Screen, useColors } from "@/components/ui";
import { getLegalDoc } from "@/constants/legal";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function LegalDocScreen() {
  const { colors } = useColors();
  const { doc: docId } = useLocalSearchParams<{ doc?: string }>();
  const doc = getLegalDoc(docId);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/legal/consent" as never);
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={back} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="callout" color="secondary" style={styles.headerTitle}>
        {doc?.title ?? "Legal"}
      </AppText>
      <View style={styles.iconBtn} />
    </View>
  );

  return (
    <Screen header={header}>
      {doc ? (
        <LegalDocumentView doc={doc} />
      ) : (
        <AppText variant="body" color="secondary" style={styles.missing}>
          That document doesn&apos;t exist.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center" },
  missing: { marginTop: Spacing.xxl },
});
