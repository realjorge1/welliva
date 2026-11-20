/**
 * services/cycle/normal.ts — the normal distribution, both ways. PURE maths.
 *
 * Shared by the fertile window (./predict fertileSpan) and the window's
 * self-check (./backtest calibrationScale), and nothing else; its own module so
 * neither imports the other for it.
 */

/** The standard normal CDF (Abramowitz & Stegun 7.1.26: error under 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Its inverse, by bisection on normalCdf: plenty for a handful of calls per forecast. */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return p >= 1 ? Infinity : -Infinity;
  let lo = -9;
  let hi = 9;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
