/**
 * useColors — single hook to read the active theme palette + scheme.
 * Wraps the app ThemeContext so UI primitives don't import it directly.
 */
import { useTheme } from "@/components/ThemeContext";
import { Colors, type ThemeColors } from "@/constants/theme";
import { useSurfaceColors } from "./SurfaceColors";

export function useColors(): {
  colors: ThemeColors;
  scheme: "light" | "dark";
  isDark: boolean;
} {
  const { currentTheme, isDarkMode } = useTheme();
  const surface = useSurfaceColors();
  // Inside an inverted surface (e.g. a deep-cyan card on the white light-mode
  // page), report that palette and treat it as "dark" so isDark-driven styling
  // (light text, glassy veils) renders correctly on the dark panel.
  if (surface) {
    return { colors: surface, scheme: "dark", isDark: true };
  }
  return {
    colors: Colors[currentTheme],
    scheme: currentTheme,
    isDark: isDarkMode,
  };
}
