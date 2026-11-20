/**
 * DIET FIT LABEL — what a diet's match score may say out loud.
 *
 * DietMatchService's score starts at 75, adds and subtracts hand-picked
 * points and clamps at 96. That is a perfectly good SORT KEY, and it stays
 * one. It is not a measurement, so showing it as "92% match" broke the owner's
 * standing rule: no number that looks measured but isn't. People now see a
 * plain label and the REASONS (buildDietReasons / DietMatchScore.reasons),
 * which say what was actually checked: "Fits your dairy-free choice. Built for
 * fat loss."
 *
 * The bands are DietMatchService's own (isRecommended 87–96, isSafeOption
 * 75–86), so the label and the lists it heads can never disagree.
 */

export type DietFitLabel = "Strong fit" | "Good fit" | "Possible";

/** DietMatchService's recommended band starts here. */
export const STRONG_FIT_MIN = 87;
/** …and its "safe option" band here. */
export const GOOD_FIT_MIN = 75;

/** The label for a match: its own flags when it carries them, else its band. */
export function dietFitLabel(
  match: number | { score: number; isRecommended?: boolean; isSafeOption?: boolean },
): DietFitLabel {
  if (typeof match !== "number") {
    if (match.isRecommended) return "Strong fit";
    if (match.isSafeOption) return "Good fit";
    return dietFitLabel(match.score);
  }
  if (match >= STRONG_FIT_MIN) return "Strong fit";
  if (match >= GOOD_FIT_MIN) return "Good fit";
  return "Possible";
}
