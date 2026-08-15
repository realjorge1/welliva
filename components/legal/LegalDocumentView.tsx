/**
 * LEGAL DOCUMENT VIEW — one renderer for all three documents.
 *
 * The policies live as structured data in constants/legal.ts; this draws them
 * with the app's own type scale and surfaces so a policy screen looks like part
 * of Welliva rather than a pasted web page. Because there is exactly one
 * renderer, the three documents can never drift apart visually.
 */
import { AppText, Card, IconBadge, useColors } from "@/components/ui";
import { LEGAL_LAST_UPDATED, LEGAL_VERSION, type LegalDoc } from "@/constants/legal";
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

export function LegalDocumentView({ doc }: { doc: LegalDoc }) {
  const { colors } = useColors();

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <IconBadge name={doc.icon as never} tone={colors.primary} size={52} />
        <AppText variant="display" style={styles.title}>
          {doc.title}
        </AppText>
        <AppText variant="body" color="secondary">
          {doc.summary}
        </AppText>
        <AppText variant="caption" color="tertiary" style={styles.stamp}>
          Version {LEGAL_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </AppText>
      </View>

      {doc.sections.map((section, i) => (
        <Card key={section.heading} padding="lg" style={styles.section}>
          <View style={styles.headingRow}>
            <AppText variant="caption" color="brand" uppercase>
              {String(i + 1).padStart(2, "0")}
            </AppText>
            <AppText variant="headline" style={styles.flex}>
              {section.heading}
            </AppText>
          </View>

          {section.body?.map((paragraph) => (
            <AppText
              key={paragraph}
              variant="subhead"
              color="secondary"
              style={styles.paragraph}
            >
              {paragraph}
            </AppText>
          ))}

          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <AppText variant="subhead" color="secondary" style={styles.flex}>
                {bullet}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: Spacing.md, paddingBottom: Spacing.xxl },
  intro: { gap: Spacing.sm, marginBottom: Spacing.md },
  title: { marginTop: Spacing.sm },
  stamp: { marginTop: Spacing.xs },
  section: { gap: Spacing.sm },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  paragraph: { lineHeight: 22 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
});
