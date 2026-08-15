/**
 * Chart types — the tiny, view-agnostic contract every trend chart speaks.
 *
 * A `ChartPoint` is one plotted sample: a numeric `value` plus the labels the
 * scrubber shows. The chart component owns all pixel math; series builders
 * (see `series.ts`) only produce ordered `ChartPoint[]`, so they stay pure and
 * unit-testable with no React-Native import.
 */

/** One sample on a trend line. */
export interface ChartPoint {
  /** The plotted magnitude (kcal, minutes, kg, %, …). */
  value: number;
  /** Short axis / tooltip label ("Jul 3", "Wk 23"). */
  label: string;
  /** Fuller label for the scrub tooltip ("Sat, Jul 3"). Falls back to `label`. */
  fullLabel?: string;
}

/** A named range of a metric — one tab in a {@link TrendCard}. */
export interface TrendSeries {
  /** Stable tab key ("1W", "3M", "All"). */
  key: string;
  /** Tab caption shown to the user. */
  label: string;
  /** The plotted samples, oldest → newest. */
  points: ChartPoint[];
  /**
   * This range is beyond the viewer's tier (see services/billing/tiers.ts).
   * The tab still renders — a visible "1 yr" you can't open yet is the reason
   * to upgrade — but it can't become active, and tapping it calls the card's
   * `onLockedRangePress` instead.
   *
   * Deliberately a plain flag rather than a billing import: this module stays
   * presentational and unit-testable with no React context in scope. Screens
   * decide what locked means and what a locked tap does.
   */
  locked?: boolean;
}
