/**
 * THE LINE OF YOUR DAY — the widget's picture, as one SVG string.
 *
 * A line of light grows from 6:00 towards midnight. Every logged moment lifts
 * it and leaves a bead of its colour at that exact time. From the moment the
 * day was kept, the line is gold; before that it is silver. Under it, a sky
 * that follows the time of day.
 *
 * Drawn for Android's widget host, whose SVG renderer (AndroidSVG) has NO
 * filters: there is no blur. The glow is built from what it does draw — wide,
 * faint strokes under the line and radial-gradient halos under the beads.
 *
 * Pure string building: no React Native, so it is tested under Node and drawn
 * in the widget's headless task the same way.
 */

import type { DayPeriod } from "./todayWords";

export type MomentKind = "food" | "water" | "move" | "mood" | "habit" | "weigh";

export interface Moment {
  /** Minutes since local midnight. */
  min: number;
  kind: MomentKind;
}

/** The bead colours (the proposal's legend; weigh-ins a soft white). */
export const MOMENT_COLORS: Readonly<Record<MomentKind, string>> = {
  food: "#FFC83D",
  water: "#4FC3F7",
  move: "#F98A26",
  mood: "#A99BFF",
  habit: "#00FFC6",
  weigh: "#E8E6F0",
};

/** How far each kind lifts the line, as a share of the drawing's lift scale. */
const LIFT: Readonly<Record<MomentKind, number>> = {
  food: 0.13,
  move: 0.19,
  water: 0.06,
  mood: 0.09,
  habit: 0.08,
  weigh: 0.07,
};

/** The line's day: 6:00 at the left edge, midnight at the right. */
export const LINE_START_MIN = 6 * 60;
export const LINE_END_MIN = 24 * 60;
/** Width of a lift, in hours: wide enough to flow, never a heart-monitor spike. */
const LIFT_WIDTH_H = 0.85;
/** Sampling step along the line, in hours. */
const STEP_H = 0.05;

const GOLD = "#EDB623";
const HOT = "#FFD873";
const CORE = "#FFF1C4";

const SKY: Readonly<Record<DayPeriod, readonly [string, string, string]>> = {
  morning: ["#25344A", "#111A26", "#0A0F16"],
  afternoon: ["#1B1D26", "#0E0F15", "#08080C"],
  evening: ["#1D1838", "#0D0B1F", "#050509"],
  night: ["#0E0D1C", "#07070F", "#030305"],
};

export interface TodayArtInput {
  /** dp. */
  width: number;
  height: number;
  moments: readonly Moment[];
  /** When the day was kept (minutes since midnight), or null. */
  keptAtMin: number | null;
  nowMin: number;
  period: DayPeriod;
  /** Corner radius of the sky, dp. */
  radius?: number;
}

/** Below this width the widget is the small (2 × 2) layout. */
export const WIDE_FROM_DP = 250;

function n(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

export function todayArtSvg(input: TodayArtInput): string {
  const w = Math.max(40, Math.round(input.width));
  const h = Math.max(40, Math.round(input.height));
  const wide = w >= WIDE_FROM_DP;
  const padX = wide ? 18 : 14;
  const base = h * (wide ? 0.8 : 0.79);
  const amp = h * (wide ? 0.78 : 0.63);
  const sw = wide ? 2 : 1.7;
  const bead = wide ? 3 : 2.5;
  const radius = input.radius ?? 22;
  const now = Math.min(LINE_END_MIN, input.nowMin);

  const x = (min: number) =>
    padX + ((Math.max(LINE_START_MIN, Math.min(LINE_END_MIN, min)) - LINE_START_MIN) / (LINE_END_MIN - LINE_START_MIN)) * (w - 2 * padX);
  const y = (min: number) => {
    const t = min / 60;
    let v = base + Math.sin(t * 1.9) * amp * 0.035 + Math.sin(t * 0.7 + 1) * amp * 0.03;
    for (const m of input.moments) {
      const d = (t - m.min / 60) / LIFT_WIDTH_H;
      v -= amp * LIFT[m.kind] * Math.exp((-d * d) / 2);
    }
    return v;
  };
  const path = (fromMin: number, toMin: number) => {
    const pts: string[] = [];
    for (let t = fromMin; t < toMin; t += STEP_H * 60) pts.push(`${n(x(t))} ${n(y(t))}`);
    pts.push(`${n(x(toMin))} ${n(y(toMin))}`);
    return `M${pts.join("L")}`;
  };

  const sky = SKY[input.period];
  const kinds = [...new Set(input.moments.map((m) => m.kind))];
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  out.push("<defs>");
  out.push(
    `<linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="0.55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>`,
  );
  for (const k of kinds) {
    out.push(
      `<radialGradient id="h-${k}"><stop offset="0" stop-color="${MOMENT_COLORS[k]}" stop-opacity="0.55"/><stop offset="1" stop-color="${MOMENT_COLORS[k]}" stop-opacity="0"/></radialGradient>`,
    );
  }
  out.push(`<radialGradient id="h-tip"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`);
  out.push("</defs>");
  out.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="url(#sky)"/>`);

  // Before 6:00 there is no line yet, only the tip waiting at the left edge.
  if (now > LINE_START_MIN) {
    const kept = input.keptAtMin != null && input.keptAtMin <= now;
    const keptFrom = kept ? Math.max(LINE_START_MIN, input.keptAtMin as number) : now;
    if (keptFrom > LINE_START_MIN) {
      out.push(
        `<path d="${path(LINE_START_MIN, keptFrom)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.32" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    if (kept && now > keptFrom) {
      const gold = path(keptFrom, now);
      out.push(`<path d="${gold}" fill="none" stroke="${GOLD}" stroke-opacity="0.1" stroke-width="${n(sw * 4.4)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path d="${gold}" fill="none" stroke="${GOLD}" stroke-opacity="0.22" stroke-width="${n(sw * 2.6)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path d="${gold}" fill="none" stroke="${HOT}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path d="${gold}" fill="none" stroke="${CORE}" stroke-opacity="0.85" stroke-width="${n(sw * 0.38)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }

  for (const m of input.moments) {
    if (m.min > now) continue;
    const cx = n(x(m.min));
    const cy = n(y(m.min));
    out.push(`<circle cx="${cx}" cy="${cy}" r="${n(bead * 3.2)}" fill="url(#h-${m.kind})"/>`);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${n(bead)}" fill="${MOMENT_COLORS[m.kind]}"/>`);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${n(bead * 0.4)}" fill="#FFFFFF" fill-opacity="0.8"/>`);
  }

  const tipMin = Math.max(LINE_START_MIN, now);
  const tx = n(x(tipMin));
  const ty = n(y(tipMin));
  out.push(`<circle cx="${tx}" cy="${ty}" r="${n(sw * 5)}" fill="url(#h-tip)"/>`);
  out.push(`<circle cx="${tx}" cy="${ty}" r="${n(sw * 1.25)}" fill="#FFFFFF"/>`);
  out.push("</svg>");
  return out.join("");
}
