/**
 * CYCLE DIAL LAYOUT — the geometry behind <CycleDial>, as plain numbers.
 *
 * The dial is the cycle as a ring of graduated strokes, the cycle-screen sibling
 * of the Diet calorie dial (components/ui/TickRing): every day of the cycle is a
 * small group of radial strokes, day 1 at the top, running clockwise, so the top
 * is also where the NEXT period begins.
 *
 * WHAT A STROKE SAYS. Its colour is what the day is (a logged period, the rest of
 * a period, the window the next one is likely in, the fertile window, the
 * estimated ovulation day). Its LENGTH swells smoothly through those runs — a
 * period is a soft bulge, the fertile window rises to a peak on the ovulation
 * day — so the shape of the cycle reads before any colour does. Ordinary days
 * are short, with a longer mark at the start of each week.
 *
 * WHERE SHE IS. Every stroke up to and including today is "lit"; the days ahead
 * are drawn dim. The stroke for today is replaced by a needle that runs deeper
 * than any other, exactly like the calorie dial's needle at its lit edge.
 *
 * THE BEZEL (big dials). A thin outer band, like a watch's, carries the scale:
 * a drop at the top where a period begins, the week numbers (8, 15, 22…) beside
 * their week marks, and a small egg on the estimated ovulation day when the
 * fertile window is shown. A number that would crowd the drop or the egg is left
 * out rather than squeezed in.
 *
 * Big dials also carry a thin inner track: a smooth line from day 1 to today
 * with a bead on today. Small dials (Home's card) are strokes and needle only.
 *
 * Pure — no React, no react-native — so the geometry is tested in
 * components/__tests__/cycleDialLayout.test.ts and can be drawn into an HTML
 * mock for a visual check without a phone.
 */
import type { DialModel } from "@/services/cycle/visual";

export type DialDayKind = "plain" | "period" | "periodAhead" | "predicted" | "fertile" | "ovulation";

/** Stroke spacing round the outer edge, in px — the calorie dial's density. */
export const DIAL_STROKE_SPACING = 6.8;
/** At most this many strokes per day, however big the dial. */
export const DIAL_MAX_PER_DAY = 4;
/** Below this size the dial is strokes and needle only — no bezel, no inner track. */
export const DIAL_COMPACT_BELOW = 140;
/** The bezel band's width, as a share of the dial. */
export const BEZEL_SHARE = 0.062;
/** An ordinary stroke, as a share of the longest. */
const MINOR = 0.5;
/** The stroke at the start of each week. */
const WEEK_MARK = 0.78;
/** The needle runs this much deeper than the longest stroke. */
export const NEEDLE_REACH = 1.32;
/** A week number closer than this (degrees) to the drop or the egg is left out. */
const BEZEL_CLEARANCE_DEG = 13;

export interface DialStroke {
  /** Position round the dial, 0 at the top. */
  index: number;
  /** Its angle, degrees clockwise from the top. */
  deg: number;
  /** 1-based day of the cycle this stroke belongs to. */
  day: number;
  kind: DialDayKind;
  /** At or before today. */
  lit: boolean;
  /** "M…L…" from the inner end to the outer end. */
  d: string;
}

export type BezelMark =
  | { kind: "drop"; deg: number; x: number; y: number }
  | { kind: "egg"; deg: number; x: number; y: number }
  | { kind: "week"; deg: number; x: number; y: number; day: number };

export interface CycleDialLayout {
  size: number;
  /** Strokes round the whole dial. */
  total: number;
  perDay: number;
  strokeWidth: number;
  /** The longest stroke's length. */
  length: number;
  outerR: number;
  strokes: DialStroke[];
  /** The stroke the needle replaces, or -1 with no today. */
  todayIndex: number;
  /** Today's angle in degrees, clockwise from the top, or null. */
  todayDeg: number | null;
  needle: { x1: number; y1: number; x2: number; y2: number; width: number } | null;
  /** The inner track's radius — 0 on a compact dial, which has none. */
  innerR: number;
  innerWidth: number;
  /** The bezel's centre line radius — 0 on a compact dial. */
  bezelR: number;
  /** The bezel's text size and glyph scale. */
  bezelSize: number;
  bezel: BezelMark[];
  /** The estimated ovulation day's angle, when the fertile window is shown. */
  ovulationDeg: number | null;
  /** What today is, or null with no today. */
  todayKind: DialDayKind | null;
  compact: boolean;
}

const n2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hermite smoothstep on [0, 1]. */
function smooth(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Smallest angle between two directions, in degrees. */
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** A point at `r` from the centre, `deg` clockwise from the top. */
export function dialPoint(size: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  const c = size / 2;
  return { x: n2(c + r * Math.sin(a)), y: n2(c - r * Math.cos(a)) };
}

/** An SVG arc at radius `r` from `fromDeg` to `toDeg`, clockwise, 0° at the top. */
export function dialArc(size: number, r: number, fromDeg: number, toDeg: number): string {
  const end = Math.min(toDeg, fromDeg + 359.9);
  const s = dialPoint(size, r, fromDeg);
  const e = dialPoint(size, r, end);
  const large = end - fromDeg > 180 ? 1 : 0;
  return `M${s.x} ${s.y}A${n2(r)} ${n2(r)} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * Where an angle sits between the top (0) and the bottom (1) of the dial. The
 * inner line's colour runs rose at the top to lilac at the bottom, so this is
 * also how far along that blend a point on it is.
 */
export function verticalShare(deg: number): number {
  return (1 - Math.cos((deg * Math.PI) / 180)) / 2;
}

/** Blend two #rrggbb colours; t = 0 is `a`, 1 is `b`. Anything else returns `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const re = /^#([0-9a-f]{6})$/i;
  const ma = re.exec(a);
  const mb = re.exec(b);
  if (!ma || !mb) return a;
  const k = clamp(t, 0, 1);
  const pa = parseInt(ma[1], 16);
  const pb = parseInt(mb[1], 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * A drop centred on (x, y), pointing away from the dial's centre at `deg`.
 * `h` is its height. One closed path: a point, two shoulders, a round base.
 */
export function dropPath(x: number, y: number, deg: number, h: number): string {
  // Drawn pointing up around the origin, then turned to face outward.
  const r = h * 0.34;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const at = (px: number, py: number) => ({ x: n2(x + px * cos - py * sin), y: n2(y + px * sin + py * cos) });
  const tip = at(0, -h * 0.55);
  const l = at(-r, h * 0.12);
  const rr = at(r, h * 0.12);
  const c1 = at(-r * 0.15, -h * 0.3);
  const c2 = at(-r, -h * 0.08);
  const c3 = at(r, -h * 0.08);
  const c4 = at(r * 0.15, -h * 0.3);
  return (
    `M${tip.x} ${tip.y}` +
    `C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${l.x} ${l.y}` +
    `A${n2(r)} ${n2(r)} 0 1 0 ${rr.x} ${rr.y}` +
    `C${c3.x} ${c3.y} ${c4.x} ${c4.y} ${tip.x} ${tip.y}Z`
  );
}

const RANK: Record<DialModel["arcs"][number]["kind"], number> = {
  fertile: 0,
  predicted: 1,
  periodAhead: 2,
  period: 3,
};

/** What each day of the cycle is. Index 0 is day 1. The record always wins. */
export function dayKinds(model: DialModel): DialDayKind[] {
  const length = Math.max(1, model.length);
  const kinds: DialDayKind[] = new Array(length).fill("plain");
  const rank: number[] = new Array(length).fill(-1);
  for (const arc of model.arcs) {
    for (let d = Math.max(1, arc.from); d <= Math.min(length, arc.to); d++) {
      if (RANK[arc.kind] > rank[d - 1]) {
        rank[d - 1] = RANK[arc.kind];
        kinds[d - 1] = arc.kind;
      }
    }
  }
  const o = model.ovulation;
  if (o !== null && o >= 1 && o <= length && (kinds[o - 1] === "plain" || kinds[o - 1] === "fertile")) {
    kinds[o - 1] = "ovulation";
  }
  return kinds;
}

const familyOf = (k: DialDayKind): "period" | "fertile" | null =>
  k === "period" || k === "periodAhead" || k === "predicted"
    ? "period"
    : k === "fertile" || k === "ovulation"
      ? "fertile"
      : null;

/**
 * Each stroke's length as a share of the longest (0–1).
 *
 * A run of period-family strokes swells and settles with soft shoulders; a run
 * of fertile-family strokes rises to a peak on the ovulation stroke. Ordinary
 * strokes are short, with a week mark on the first stroke of days 1, 8, 15…
 */
export function strokeShares(kinds: readonly DialDayKind[], perDay: number): number[] {
  const total = kinds.length * perDay;
  const kindAt = (i: number) => kinds[Math.floor(i / perDay)];
  const shares = new Array<number>(total).fill(MINOR);

  for (let i = 0; i < total; i++) {
    const day = Math.floor(i / perDay) + 1;
    if (familyOf(kindAt(i)) === null && i % perDay === 0 && (day - 1) % 7 === 0) shares[i] = WEEK_MARK;
  }

  let i = 0;
  while (i < total) {
    const fam = familyOf(kindAt(i));
    if (fam === null) {
      i++;
      continue;
    }
    let j = i;
    while (j < total && familyOf(kindAt(j)) === fam) j++;
    const n = j - i;
    if (fam === "period") {
      // Soft shoulders over the first and last ~30% of the run.
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n;
        const e = smooth(t / 0.3) * smooth((1 - t) / 0.3);
        shares[i + s] = MINOR + (1 - MINOR) * e;
      }
    } else {
      // A bell centred on the ovulation stroke (the middle of that day's group).
      let peak = -1;
      for (let s = 0; s < n; s++) {
        if (kindAt(i + s) === "ovulation") {
          peak = s + Math.floor(perDay / 2);
          break;
        }
      }
      const sigma = Math.max(1.2, perDay * 1.7);
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n;
        const edge = smooth(t / 0.2) * smooth((1 - t) / 0.2);
        const e =
          peak >= 0
            ? Math.max(0.35 * edge, Math.exp(-(((s - peak) / sigma) ** 2)))
            : edge * 0.8;
        shares[i + s] = MINOR + (1 - MINOR) * e;
      }
    }
    i = j;
  }
  return shares;
}

export function cycleDialLayout(model: DialModel, size: number, strokeWidthOverride?: number): CycleDialLayout {
  const length = Math.max(1, model.length);
  const compact = size < DIAL_COMPACT_BELOW;
  const band = compact ? 0 : size * BEZEL_SHARE;

  // The longest stroke, the needle, and the stroke width all scale with the dial.
  const tickLen = compact ? Math.max(5, size * 0.1) : size * 0.066;
  const outerGuess = size / 2 - band - 2;
  const circumference = 2 * Math.PI * outerGuess;
  const perDay = clamp(Math.round(circumference / (length * DIAL_STROKE_SPACING)), 1, DIAL_MAX_PER_DAY);
  const total = length * perDay;
  const spacing = circumference / total;
  const strokeWidth = strokeWidthOverride ?? n2(clamp(spacing * 0.4, 1.6, 3.4));
  const needleWidth = n2(strokeWidth * 1.25);

  // Round caps reach half a width past each end: keep the outer end inside the box.
  const outerR = size / 2 - band - needleWidth / 2 - 0.5;
  const kinds = dayKinds(model);
  const shares = strokeShares(kinds, perDay);

  const today = model.today !== null ? clamp(model.today, 1, length) : null;
  const todayIndex = today !== null ? (today - 1) * perDay + Math.floor(perDay / 2) : -1;
  const degOf = (i: number) => n2(((i + 0.5) / total) * 360);

  const strokes: DialStroke[] = [];
  for (let i = 0; i < total; i++) {
    if (i === todayIndex) continue; // the needle stands here
    const deg = degOf(i);
    const inner = outerR - tickLen * shares[i];
    const a = dialPoint(size, inner, deg);
    const b = dialPoint(size, outerR, deg);
    strokes.push({
      index: i,
      deg,
      day: Math.floor(i / perDay) + 1,
      kind: kinds[Math.floor(i / perDay)],
      lit: todayIndex >= 0 && i < todayIndex,
      d: `M${a.x} ${a.y}L${b.x} ${b.y}`,
    });
  }

  const todayDeg = todayIndex >= 0 ? degOf(todayIndex) : null;
  let needle: CycleDialLayout["needle"] = null;
  if (todayDeg !== null) {
    const a = dialPoint(size, outerR - tickLen * NEEDLE_REACH, todayDeg);
    const b = dialPoint(size, outerR, todayDeg);
    needle = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: needleWidth };
  }

  const gap = Math.max(5, size * 0.035);
  const innerWidth = compact ? 0 : n2(clamp(size * 0.011, 2, 3.6));
  const innerR = compact ? 0 : n2(outerR - tickLen * NEEDLE_REACH - gap - innerWidth / 2);

  const o = model.ovulation;
  const ovulationDeg =
    o !== null && o >= 1 && o <= length ? degOf((o - 1) * perDay + Math.floor(perDay / 2)) : null;

  // ── the bezel ──────────────────────────────────────────────────────────
  const bezelR = compact ? 0 : n2(size / 2 - band / 2);
  const bezelSize = compact ? 0 : n2(Math.max(8, size * 0.031));
  const bezel: BezelMark[] = [];
  if (!compact) {
    const top = dialPoint(size, bezelR, 0);
    bezel.push({ kind: "drop", deg: 0, ...top });
    if (ovulationDeg !== null) bezel.push({ kind: "egg", deg: ovulationDeg, ...dialPoint(size, bezelR, ovulationDeg) });
    for (let day = 8; day <= length; day += 7) {
      const deg = degOf((day - 1) * perDay);
      if (angleGap(deg, 0) < BEZEL_CLEARANCE_DEG) continue;
      if (ovulationDeg !== null && angleGap(deg, ovulationDeg) < BEZEL_CLEARANCE_DEG) continue;
      bezel.push({ kind: "week", deg, day, ...dialPoint(size, bezelR, deg) });
    }
  }

  return {
    size,
    total,
    perDay,
    strokeWidth,
    length: tickLen,
    outerR: n2(outerR),
    strokes,
    todayIndex,
    todayDeg,
    needle,
    innerR,
    innerWidth,
    bezelR,
    bezelSize,
    bezel,
    ovulationDeg,
    todayKind: today !== null ? kinds[today - 1] : null,
    compact,
  };
}
