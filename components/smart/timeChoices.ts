/**
 * A row of offered times, with the stored time among them.
 *
 * Every reminder picker in the app offers a short list of times (chips or a
 * segmented control). A reminder can now hold a time that isn't on its list —
 * one moved to when the thing actually happens — and a picker that can't show
 * the stored time lies: it highlights the wrong chip, or none, and a save then
 * keeps a time the user cannot see.
 *
 * So the stored time takes the place of the NEAREST offered one: the row keeps
 * its length (it was laid out for that many) and stays in time order. Pure.
 */
export function withStoredTime<T>(
  offered: readonly T[],
  stored: T | null | undefined,
  minuteOf: (t: T) => number,
): T[] {
  if (stored == null || offered.length === 0) return [...offered];
  const at = minuteOf(stored);
  if (offered.some((t) => minuteOf(t) === at)) return [...offered];
  let nearest = 0;
  for (let i = 1; i < offered.length; i++) {
    if (Math.abs(minuteOf(offered[i]) - at) < Math.abs(minuteOf(offered[nearest]) - at)) nearest = i;
  }
  return offered
    .map((t, i) => (i === nearest ? stored : t))
    .sort((a, b) => minuteOf(a) - minuteOf(b));
}
