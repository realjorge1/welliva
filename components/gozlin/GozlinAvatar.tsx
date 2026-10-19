/**
 * GozlinAvatar — the coach's identity mark as a round avatar.
 *
 * The diamond sits on its own black ground, exactly as it does on the app icon
 * it came from, cropped round and edged with a gold hairline.
 *
 * IT IS STILL. It used to take a `pulsing` prop that breathed the mark 1 → 1.08
 * and back in a loop — on the header button of every main screen, in the chat
 * header while Gozlin worked, and on celebratory moment cards. The owner had
 * it killed (2026-10-15). In the chat the working state is already carried by
 * the presence dot's tempo beside the name, so nothing was lost there.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import AILogoIcon from "./AILogoIcon";

/** The art's own ground. The cut-out mark laid on it IS the original icon. */
export const MARK_GROUND = "#000000";
/** How much of the disc's diameter the mark's box fills — tips clear the edge. */
export const MARK_IN_DISC = 0.82;
const EDGE = "rgba(237,182,35,0.4)";

export function GozlinAvatar({
  size = 36,
  edge = true,
}: {
  size?: number;
  /** The gold hairline. Off when something else already draws the rim. */
  edge?: boolean;
}) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <AILogoIcon size={Math.round(size * MARK_IN_DISC)} />
      {/* Its own layer, drawn after the art: a border on the clipping view
          itself would sit UNDER the image. */}
      {edge ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              borderWidth: Math.max(1, size * 0.03),
              borderColor: EDGE,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: MARK_GROUND,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
