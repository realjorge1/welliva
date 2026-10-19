/**
 * WORDMARK — "welliva" is drawn the way the app icon draws it, wherever it is read.
 *
 * Owner, 2026-10-15: "everywhere welliva is displayed or written across the
 * app, let it be in the font type and style as it is on the app icon." The
 * icon is the word in gold Pacifico on black (`assets/images/icon-wordmark*.png`,
 * the launcher foreground and the splash are the same render), so the word is
 * set in that face and that gold — in a title, in a button, in the middle of a
 * sentence.
 *
 * IT HAPPENS IN ONE PLACE. `AppText` is the app's only text component, and it
 * passes its children through `withWordmark`, so every string that reaches the
 * screen through it — titles, subtitles, legal prose, onboarding lines, tier
 * names like "welliva Pro" — gets the treatment without its call site knowing.
 * A new screen gets it for free; nobody has to remember. The handful of raw
 * `<Text>` surfaces (the auth header) call the same function.
 *
 * WHAT IT CANNOT REACH, and nothing in the app can: text the OS draws. Native
 * alerts (`Alert.alert`), notification titles and bodies, iOS permission
 * prompts from app.json, the share sheet. Those stay in the system face.
 *
 * THE SPAN RESETS WHAT WOULD DISTORT THE ICON'S SHAPE. Weight goes to normal
 * (Pacifico ships one weight, and a bold request is synthesised into a smear on
 * Android and can fall back to the system face on iOS), tracking to zero (a
 * script face's letters join; spacing them apart breaks the joins), and
 * `textTransform` to none, because the brand is lowercase even inside an
 * uppercase caption. Size is inherited: the word sits in the line it is in.
 *
 * THE GOLD IS FIXED, NOT THEMED. It is the icon's ink, `#EDB623` — the icon
 * doesn't change with the theme, so neither does its word. The one place gold
 * would vanish is a gold-filled button; `Button` passes its label colour as
 * `color` there, keeping the face and losing only the ink.
 */
import React from "react";
import { Text, type TextStyle } from "react-native";

/** The brand, exactly as written. Always lowercase — see the brand-casing rule. */
export const BRAND_WORD = "welliva";
/** The icon's ink (the wordmark renders and the splash use the same value). */
export const WORDMARK_GOLD = "#EDB623";
/** The family name registered by `useFonts` in app/_layout.tsx. */
export const WORDMARK_FONT = "Pacifico";

const SPAN: TextStyle = {
  fontFamily: WORDMARK_FONT,
  fontWeight: "normal",
  fontStyle: "normal",
  letterSpacing: 0,
  textTransform: "none",
};

/** Cheap enough to run on every render of every AppText: no allocation on a miss. */
export function hasWordmark(children: React.ReactNode): boolean {
  if (typeof children === "string") return children.includes(BRAND_WORD);
  if (Array.isArray(children)) {
    return children.some((c) => typeof c === "string" && c.includes(BRAND_WORD));
  }
  return false;
}

function splitString(text: string, color: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(BRAND_WORD);
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i > 0) {
      out.push(
        <Text key={`${keyBase}-${i}`} style={[SPAN, { color }]}>
          {BRAND_WORD}
        </Text>,
      );
    }
    if (part) out.push(part);
  });
  return out;
}

/**
 * `children` with every literal "welliva" in a string child set as the
 * wordmark. Elements pass through untouched (a nested AppText does its own).
 * Returns `children` itself when there is nothing to do.
 */
export function withWordmark(
  children: React.ReactNode,
  color: string = WORDMARK_GOLD,
): React.ReactNode {
  if (!hasWordmark(children)) return children;
  if (typeof children === "string") return splitString(children, color, "wm");
  return (children as React.ReactNode[]).flatMap((child, i) =>
    typeof child === "string" && child.includes(BRAND_WORD)
      ? splitString(child, color, `wm${i}`)
      : [child],
  );
}
