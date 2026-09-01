/**
 * chipGridLayout — the arithmetic behind ChipGrid, with no React in it.
 *
 * Split out of the component for one reason: this is where the whole design
 * lives, and it is pure. Breaking a row is a decision about numbers — how wide
 * a label wants to be, how many fit, and how to deal the remainder — and it can
 * be checked exhaustively in a test runner instead of by squinting at a phone.
 *
 * See ChipGrid.tsx for what the two passes are FOR.
 */

export interface ChipMetric {
  label: string;
  hasIcon?: boolean;
}

/**
 * How wide a label wants to be, in points.
 *
 * An ESTIMATE, and deliberately so: measuring every chip would mean a layout
 * pass per option and a second frame of reflow, to decide something the
 * justification pass then corrects anyway. Only the BREAK depends on this, and
 * a break that is one character out looks identical.
 *
 * It errs HIGH on purpose. Over-estimating costs at most one chip off a row —
 * still a justified row, just a roomier one. Under-estimating packs a row too
 * tight and the labels wrap to two lines, which is the one outcome that looks
 * like a bug, so the asymmetry is priced in rather than tuned out.
 *
 * The per-character figure is for the chip's own semibold text; the padding is
 * its horizontal inset plus its border.
 */
const METRICS = {
  md: { char: 8.2, pad: 34, icon: 21 },
  sm: { char: 7.2, pad: 26, icon: 19 },
} as const;

export type ChipSize = keyof typeof METRICS;

export function estimateChipWidth(chip: ChipMetric, size: ChipSize): number {
  const m = METRICS[size];
  return chip.label.length * m.char + m.pad + (chip.hasIcon ? m.icon : 0);
}

/** Does a run of chips fit on one row? */
function fits(
  widths: readonly number[],
  from: number,
  count: number,
  containerWidth: number,
  gap: number,
): boolean {
  let sum = gap * (count - 1);
  for (let i = from; i < from + count; i++) sum += widths[i];
  // A single chip always "fits": one too wide for the screen still needs a row,
  // and giving it one is better than leaving an empty row above it.
  return count <= 1 || sum <= containerWidth;
}

/**
 * Break a list of chip widths into justifiable rows.
 *
 * Greedy first, to learn how FEW rows the width allows; then an even re-deal
 * across exactly that many rows, kept only when every row of it still fits.
 *
 * The re-deal is what stops six short options coming out as four-then-two, and
 * what stops five coming out as four-then-a-widow. Greedy breaking fills each
 * row to the brim and dumps the remainder on the last one; balanced breaking
 * treats the row COUNT as the constraint and evenness as the goal, which is the
 * same instinct as balancing a headline over two lines.
 */
export function packRows(
  widths: readonly number[],
  containerWidth: number,
  gap: number,
  maxPerRow: number,
): number[][] {
  if (widths.length === 0 || containerWidth <= 0) return [];

  // ── Pass 1: greedy — how many rows does this actually need? ──
  const greedy: number[][] = [];
  let row: number[] = [];
  let used = 0;
  for (let i = 0; i < widths.length; i++) {
    const next = used + widths[i] + (row.length > 0 ? gap : 0);
    if (row.length > 0 && (next > containerWidth || row.length >= maxPerRow)) {
      greedy.push(row);
      row = [i];
      used = widths[i];
    } else {
      row.push(i);
      used = next;
    }
  }
  if (row.length > 0) greedy.push(row);
  if (greedy.length < 2) return greedy;

  // ── Pass 2: deal the same chips evenly across the same number of rows ──
  const rowCount = greedy.length;
  const base = Math.floor(widths.length / rowCount);
  const extra = widths.length % rowCount;
  if (base < 1 || base + (extra > 0 ? 1 : 0) > maxPerRow) return greedy;

  const balanced: number[][] = [];
  let cursor = 0;
  for (let r = 0; r < rowCount; r++) {
    // The longer rows go FIRST: a page reads top-down, and a block that narrows
    // as it descends looks intentional where one that widens looks like it ran
    // out of room.
    const count = base + (r < extra ? 1 : 0);
    if (!fits(widths, cursor, count, containerWidth, gap)) {
      // The even deal is all-or-nothing, and for a long mixed-length list (the
      // eleven injury areas, say) it usually fails on the first row. Rather
      // than hand back raw greedy — which for that list ends 3, 3, then a
      // single stranded chip — repair just the widow.
      return fixWidow(greedy, widths, containerWidth, gap);
    }
    balanced.push(Array.from({ length: count }, (_, k) => cursor + k));
    cursor += count;
  }
  return balanced;
}

/**
 * Pull one chip down onto a stranded last row.
 *
 * Only when the row above can spare it — three or more — because turning a
 * two-then-one into a one-then-two is not an improvement, it is the same widow
 * moved to the top where it is more conspicuous. With three options and room
 * for two, someone gets a row to themselves; the justification at least makes
 * it look deliberate.
 */
function fixWidow(
  rows: number[][],
  widths: readonly number[],
  containerWidth: number,
  gap: number,
): number[][] {
  if (rows.length < 2) return rows;
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (last.length !== 1 || prev.length < 3) return rows;

  const moved = prev[prev.length - 1];
  if (!fits(widths, moved, 2, containerWidth, gap)) return rows;

  const repaired = rows.map((r) => [...r]);
  repaired[repaired.length - 2] = prev.slice(0, -1);
  repaired[repaired.length - 1] = [moved, ...last];
  return repaired;
}

/**
 * Each chip's final width in a row, sharing the leftover space in proportion to
 * what its label asked for.
 *
 * Floored to a tenth of a point: a solved width that lands a hair over its
 * container is enough for the last cell of a row to be pushed onto a line of
 * its own, and a rounding crumb is cheaper than a broken row.
 */
export function justifyRow(
  widths: readonly number[],
  row: readonly number[],
  containerWidth: number,
  gap: number,
): number[] {
  const available = containerWidth - gap * (row.length - 1);
  const asked = row.reduce((sum, i) => sum + widths[i], 0);
  if (asked <= 0) return row.map(() => available / row.length);
  return row.map((i) => Math.floor(available * (widths[i] / asked) * 10) / 10);
}
