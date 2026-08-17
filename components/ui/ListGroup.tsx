/**
 * ListGroup — a card that holds a stack of `ListRow`s and owns everything
 * BETWEEN them: the hairline dividers, their inset, and clipping the rows'
 * press wash to the card's rounded corners.
 *
 * Rows used to carry a `divider` prop each, which meant every conditional row
 * ("only in dev", "only when signed in") had to hand-maintain which of its
 * neighbours drew the line — a stray hairline under the last row was one
 * `divider={__DEV__}` away. Here the separators are derived from the children
 * that actually rendered, so they cannot drift.
 */
import { Radius } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Card } from "./Card";
import { ROW_TEXT_INSET } from "./ListRow";
import { useColors } from "./useColors";

export interface ListGroupProps {
  children: React.ReactNode;
  /**
   * Start the dividers under the row's title (default) instead of running them
   * edge to edge. Turn it off for groups whose rows have no leading badge.
   */
  inset?: boolean;
  /** Extra padding inside the card, e.g. for a group with a custom footer. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function ListGroup({
  children,
  inset = true,
  padding,
  style,
}: ListGroupProps) {
  const { colors } = useColors();
  // toArray drops null/undefined/booleans, so `{cond ? <Row/> : null}` simply
  // isn't a child — no divider is drawn for a row that never rendered.
  const rows = React.Children.toArray(children);

  return (
    <Card
      padding={padding ?? "none"}
      // Rows paint a full-bleed press wash; without this it would square off
      // the card's corners on the first and last row.
      style={[styles.clip, style]}
    >
      {rows.map((row, i) => (
        <React.Fragment key={(row as React.ReactElement).key ?? i}>
          {i > 0 ? (
            <View
              style={[
                styles.divider,
                {
                  backgroundColor: colors.divider,
                  marginLeft: inset ? ROW_TEXT_INSET : 0,
                },
              ]}
            />
          ) : null}
          {row}
        </React.Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", borderRadius: Radius.xl },
  divider: { height: StyleSheet.hairlineWidth },
});
