/**
 * DOT MATRIX — the 5×7 LED-display digits behind <DotNumeral>.
 *
 * Pure geometry, no React: a digit string in, dot centres out. It lives apart
 * from the component so the LOOK can be pinned by arithmetic — every digit is
 * distinct, a figure never outgrows the room it is given — instead of by eye on
 * one phone.
 *
 * A figure is drawn from TWO layers of the same grid: the lit dots, and a faint
 * ghost of every position that is not lit. The ghost is what makes it read as a
 * display with a fixed number of cells, rather than as dotted type.
 */

export const DOT_COLS = 5;
export const DOT_ROWS = 7;
/** Blank columns between two digits. */
export const DOT_GAP_COLS = 1;
/** Lit dot diameter as a share of the pitch (centre-to-centre distance). */
export const DOT_FILL = 0.74;
/**
 * An UNLIT cell is drawn this much smaller than a lit dot, as well as fainter.
 * Same-sized ghosts made the whole grid read as one busy block of dots with a
 * figure somewhere in it; smaller ghosts recede into a texture behind the
 * figure, which is what lets the lit dots stand out as the number.
 */
export const GHOST_SCALE = 0.6;
/** Wider than any figure the app draws; a runaway value must not become "1e+21". */
const MAX_VALUE = 99_999;

/**
 * "#" is a lit dot. Zero has no slash, so 0 and 8 can never be confused at the
 * small sizes these are drawn at.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  // The few signs and letters a display has to say besides a number: the lead
  // "+" of an overtime count, and the words GO and DONE. O is the zero's shape —
  // on a display they are the same lamp pattern.
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
};

/**
 * A word or signed figure as the characters a display can draw: upper-cased,
 * anything without a glyph dropped. ("+12", "go" → "GO", "DONE").
 */
export function glyphsOf(text: string): string {
  return [...text.toUpperCase()].filter((c) => c in GLYPHS).join("");
}

export interface Dot {
  x: number;
  y: number;
}

export interface DotLayout {
  width: number;
  height: number;
  /** Lit dot radius, in the same units as the centres. */
  radius: number;
  /** The radius of an unlit cell — smaller than `radius`, see GHOST_SCALE. */
  ghostRadius: number;
  lit: Dot[];
  ghost: Dot[];
}

/** A value as the digits a display would show: whole, never negative. */
export function digitsOf(value: number): string {
  const v = Number.isFinite(value) ? Math.round(value) : 0;
  return String(Math.min(MAX_VALUE, Math.max(0, v)));
}

/** How many dot columns a figure of `digits` digits spans, gaps included. */
export function figureColumns(digits: number): number {
  return digits <= 0 ? 0 : digits * DOT_COLS + (digits - 1) * DOT_GAP_COLS;
}

/**
 * The pitch that makes a figure fit `maxWidth`, never larger than `maxPitch`.
 * A fourth digit shrinks the dots rather than overflowing the card around them.
 */
export function fitPitch(digits: number, maxWidth: number, maxPitch: number): number {
  const cols = figureColumns(digits);
  if (cols === 0 || !(maxWidth > 0)) return maxPitch;
  return Math.min(maxPitch, maxWidth / cols);
}

/** Dot centres for a string of glyphs at the given pitch. Anything without a glyph is skipped. */
export function dotLayout(digits: string, pitch: number): DotLayout {
  const chars = [...digits].filter((c) => c in GLYPHS);
  const lit: Dot[] = [];
  const ghost: Dot[] = [];

  chars.forEach((c, n) => {
    const left = n * (DOT_COLS + DOT_GAP_COLS);
    GLYPHS[c].forEach((row, r) => {
      for (let col = 0; col < DOT_COLS; col++) {
        const dot = { x: (left + col + 0.5) * pitch, y: (r + 0.5) * pitch };
        (row[col] === "#" ? lit : ghost).push(dot);
      }
    });
  });

  const radius = (pitch * DOT_FILL) / 2;
  return {
    width: figureColumns(chars.length) * pitch,
    height: DOT_ROWS * pitch,
    radius,
    ghostRadius: radius * GHOST_SCALE,
    lit,
    ghost,
  };
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/**
 * One SVG path for any number of dots — a full circle per dot, drawn as two
 * arcs. A single <Path> instead of a <Circle> each: a three-digit figure is
 * over a hundred dots, and one element is what keeps a screen of them cheap.
 */
export function dotsPath(dots: readonly Dot[], radius: number): string {
  const r = n2(radius);
  let d = "";
  for (const { x, y } of dots) {
    d += `M${n2(x - r)} ${n2(y)}a${r} ${r} 0 1 0 ${n2(2 * r)} 0a${r} ${r} 0 1 0 ${n2(-2 * r)} 0`;
  }
  return d;
}

/** The glyph art, for tests that pin the shapes. */
export function glyphRows(digit: string): readonly string[] | undefined {
  return GLYPHS[digit];
}
