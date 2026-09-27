/**
 * GOZLIN AGENT — the stream gate.
 *
 * Grounding (./grounding.ts) and output safety (./outputSafety.ts) judge a
 * FINISHED reply. The reply streams, though, and it used to stream straight into
 * the bubble — so a draft those checks went on to reject had already been read.
 * The invented "340 calories over" sat on screen for a second, then vanished
 * into a regeneration. A check that runs after the user has seen the thing it
 * exists to stop is only half a check.
 *
 * This decides, for a draft still arriving, how much of it may be SHOWN:
 *
 *   1. Never the last, still-arriving token. "1,8" might become "1,840" or
 *      "1,850"; "three hundred" might become "three hundred and forty". A
 *      figure is judged once it is finished, and not before.
 *   2. Never past the first figure grounding could not vouch for right now.
 *   3. Never into a sentence the output screen would reject.
 *
 * Everything before those points is exactly what the finished checks would
 * pass, so showing it early is free. Everything after waits for the verdict,
 * and if the verdict is a rewrite, it was never on screen at all.
 *
 * Pure, synchronous and cheap on a few hundred characters, because it runs on
 * every delta.
 */

import { isGrounded, isProseNumber, numberSpans } from "./grounding";
import { screenOutput } from "./outputSafety";

/** After a spelled-out number, what may still be the same number arriving. */
const WORD_NUMBER_MAY_CONTINUE = /^[\s-]*(?:a(?:n(?:d)?)?[\s-]*)?$/i;

/**
 * How many leading characters of `draft` are safe to display, given the
 * figures the model is allowed to cite this turn.
 */
export function safeDisplayLength(draft: string, allowed: Set<number>): number {
  // 1. Hold back the trailing token — it is still being written.
  const trailing = /\S*$/.exec(draft);
  const stableEnd = trailing ? trailing.index : draft.length;
  const stable = draft.slice(0, stableEnd);
  let limit = stableEnd;

  // 2. The first figure that is not (yet) backed. A spelled-out number whose
  //    next words have not arrived is held too: "three hundred " could still
  //    grow into a different claim.
  for (const span of numberSpans(stable)) {
    if (span.kind === "words" && WORD_NUMBER_MAY_CONTINUE.test(stable.slice(span.end))) {
      limit = Math.min(limit, span.start);
      break;
    }
    if (isProseNumber(span.value)) continue;
    if (!isGrounded(span.value, allowed)) {
      limit = Math.min(limit, span.start);
      break;
    }
  }

  // 3. The sentence the output screen would reject, from its first word.
  const risk = screenOutput(stable);
  if (risk) {
    const at = stable.indexOf(risk.matched);
    if (at >= 0) limit = Math.min(limit, sentenceStart(stable, at));
  }

  return limit;
}

/** Index where the sentence containing `at` begins. */
function sentenceStart(text: string, at: number): number {
  let i = at;
  while (i > 0 && !/[.!?\n]/.test(text[i - 1])) i--;
  while (i < at && /\s/.test(text[i])) i++;
  return i;
}
