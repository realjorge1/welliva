/**
 * The cycle tracker's colours.
 *
 * One rose for the period, used identically everywhere it appears (dial,
 * calendar, chips, Home card), and a lilac for the fertile window — which only
 * ever appears when she has chosen to see it. Both sit apart from the gold brand
 * and from every data-viz hue in constants/theme (calories coral, protein teal,
 * fat periwinkle), so a cycle mark can't be misread as a macro.
 *
 * Forecasts use the SAME hue at lower strength: a predicted day must read as
 * lighter than a logged one, never as a different kind of thing.
 */
import { useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import { useMemo } from "react";

export interface CyclePalette {
  /** A logged period day. */
  period: string;
  /** Text drawn on a solid period fill. */
  onPeriod: string;
  /** The rest of an ongoing period, and the guessed tail of an unended one. */
  periodAhead: string;
  /** A forecast period day — drawn lighter than a record. */
  predicted: string;
  /** A forecast day's number on its light fill. */
  predictedInk: string;
  fertile: string;
  fertileSoft: string;
  ovulation: string;
  /** The empty ring behind everything. */
  track: string;
  /** Soft wash for cards that carry the cycle's colour. */
  wash: string;
}

export function useCyclePalette(): CyclePalette {
  const { colors, isDark } = useColors();
  return useMemo(() => {
    const period = isDark ? "#F2789A" : "#D9466F";
    const fertile = isDark ? "#B8A4F4" : "#7B61D9";
    return {
      period,
      onPeriod: isDark ? "#2A0812" : "#FFFFFF",
      periodAhead: alpha(period, isDark ? 0.5 : 0.45),
      predicted: alpha(period, isDark ? 0.3 : 0.26),
      predictedInk: isDark ? "#F7A7BD" : "#B23A5E",
      fertile,
      fertileSoft: alpha(fertile, isDark ? 0.2 : 0.16),
      ovulation: isDark ? "#DCD1FF" : "#5A3FC4",
      track: alpha(colors.text, isDark ? 0.08 : 0.1),
      wash: alpha(period, isDark ? 0.1 : 0.08),
    };
  }, [colors.text, isDark]);
}
