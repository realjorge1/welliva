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
  /**
   * The dial's thin strokes (components/cycle/CycleDial). A hairline needs a
   * little more strength than a filled cell to read as the same thing, so the
   * forecast tones here are the calendar's, a notch stronger.
   */
  dial: {
    /** Ordinary days already behind her: a pearl that runs blush to lilac, top to bottom. */
    litTop: string;
    litBottom: string;
    /** Ordinary days still ahead. */
    idle: string;
    periodAhead: string;
    predicted: string;
    /** Fertile days still ahead. */
    fertileAhead: string;
    /** A logged period runs deep on day 1 to light on its last day. */
    periodDeep: string;
    periodLight: string;
    /** The bezel's week numbers, and its outer hairline. */
    bezelInk: string;
    hairline: string;
    /** The soft glow under lit period and fertile strokes (its strongest layer). */
    bloom: number;
    /** The radial glow behind the centre. */
    centreGlow: number;
  };
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
      dial: {
        litTop: isDark ? "rgba(255,226,236,0.82)" : "rgba(96,80,94,0.72)",
        litBottom: isDark ? "rgba(222,214,255,0.82)" : "rgba(86,82,128,0.72)",
        idle: alpha(colors.text, 0.17),
        periodAhead: alpha(period, isDark ? 0.55 : 0.5),
        predicted: alpha(period, isDark ? 0.42 : 0.38),
        fertileAhead: alpha(fertile, isDark ? 0.5 : 0.45),
        periodDeep: isDark ? "#E8457A" : "#B92A55",
        periodLight: isDark ? "#FFB0C6" : "#EC7C9D",
        bezelInk: alpha(colors.text, isDark ? 0.5 : 0.52),
        hairline: alpha(colors.text, isDark ? 0.09 : 0.1),
        bloom: isDark ? 0.15 : 0.1,
        centreGlow: isDark ? 0.18 : 0.1,
      },
    };
  }, [colors.text, isDark]);
}
