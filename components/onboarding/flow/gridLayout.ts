/**
 * GRID LAYOUT — measured option grids.
 *
 * Option grids in the onboarding are MEASURED, not wrapped, and this is the
 * arithmetic that does it. The problem it solves is visible on the health
 * step: seven conditions in two columns leaves a lone tile clinging to the left
 * margin, and the whole block reads lopsided.
 *
 * So a short LAST row stretches its cells to share the full width. Every row —
 * full or short — spans exactly the content width, which is the invariant the
 * tests lock down.
 *
 * Pure arithmetic, in its own module so it can be tested without a React Native
 * runtime.
 */

/** Width of one cell in a row of `span` equal cells. */
export function cellWidth(total: number, span: number, gap: number): number {
  if (span <= 0) return 0;
  return (total - gap * (span - 1)) / span;
}

/**
 * The width of every cell in a grid of `count` options laid out in `columns`.
 *
 * Cells on a full row all share the width equally. Cells on a short final row
 * are widened to fill it, so the row still ends flush with the right gutter.
 */
export function measureGrid(
  count: number,
  columns: number,
  total: number,
  gap: number,
): number[] {
  if (count <= 0 || columns <= 0) return [];
  const remainder = count % columns;
  const lastRowStart = count - remainder;
  return Array.from({ length: count }, (_, i) =>
    cellWidth(total, remainder !== 0 && i >= lastRowStart ? remainder : columns, gap),
  );
}

/**
 * The cell widths grouped by row — the shape the invariant is stated in: each
 * row's cells plus its gaps must add up to the full content width.
 */
export function gridRows(
  count: number,
  columns: number,
  total: number,
  gap: number,
): number[][] {
  const cells = measureGrid(count, columns, total, gap);
  const rows: number[][] = [];
  for (let i = 0; i < cells.length; i += columns) {
    rows.push(cells.slice(i, i + columns));
  }
  return rows;
}
