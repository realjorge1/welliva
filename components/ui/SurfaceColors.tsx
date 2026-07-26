/**
 * SurfaceColors — a context that lets a container hand an INVERTED color set to
 * everything rendered inside it. `useColors()` reads it, so any design-system
 * component (AppText, IconBadge, Divider, ProgressBar, …) placed inside the
 * container automatically themes for that surface with zero prop drilling.
 *
 * The one consumer today is `<Card>` in light mode: cards are deep-cyan panels
 * on a white page, so their children must render light-on-dark.
 */
import type { ThemeColors } from "@/constants/theme";
import { createContext, useContext } from "react";

const SurfaceColorsContext = createContext<ThemeColors | null>(null);

export const SurfaceColorsProvider = SurfaceColorsContext.Provider;

/** The active surface override, or null when on the page's own canvas. */
export function useSurfaceColors(): ThemeColors | null {
  return useContext(SurfaceColorsContext);
}
