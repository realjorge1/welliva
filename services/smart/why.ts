/**
 * services/smart/why.ts
 *
 * YOUR REASON, IN YOUR OWN WORDS — asked once, kept exactly as typed, and quoted
 * back rarely, on a wobbly moment:
 *
 *   On 3 November you said: “I want to keep up with my kids”. Still true?
 *   [Still true]  [Change it]  Not now
 *
 * There is no store here: the words live in Gozlin's identity memory
 * (`GozlinIdentityMemory.motivation`), the slot the coach already reads, and the
 * dates travel beside them. Erase and Clear memory take it all with them.
 *
 * The rules that matter:
 *   · THEIR WORDS. Trimmed, never rewritten, paraphrased or completed. The quote
 *     marks hold exactly what they typed — no full stop added.
 *   · RARE. At most once every {@link WHY_QUOTE_GAP_DAYS} days, answered or not.
 *   · ONLY ON A WOBBLY MOMENT: the day after a run of {@link WHY_LAPSE_RUN} or more
 *     lapsed, or the evening before their known hard weekday. (The welcome-back
 *     screen shows it too, as part of that one moment.)
 *   · NEVER ON A ROUGH DAY — the quiet layer sees to that.
 *
 * Pure.
 */
import { shiftDay } from "../commitment";
import { wallClockOf } from "../routine/clock";
import { daysFrom } from "./arbiter";

/** One sentence, generously. A limit on the box, never on what's kept. */
export const WHY_MAX_CHARS = 200;

/** Quoted back at most once a month, or it stops meaning anything. */
export const WHY_QUOTE_GAP_DAYS = 30;

/** A run at least this long, just lapsed, is a wobble worth noticing. */
export const WHY_LAPSE_RUN = 3;

/** Monthly at most, so it outranks a daily "your usual?". Below the hard day it may sit beside. */
export const WHY_PRIORITY = 58;

export const WHY_ID = "why:quote";

/** Their example words: a person's reasons, not a health goal. */
export const WHY_PLACEHOLDER = "I want to keep up with my kids";
export const WHY_PLACEHOLDER_ALT = "I want to feel strong again";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "On 3 November you said:", or plainly "You said:" when the day isn't known. */
export function whyLead(at: string | undefined): string {
  const date = at ? wallClockOf(at)?.date : null;
  if (!date) return "You said:";
  const [, m, d] = date.split("-").map(Number);
  return `On ${d} ${MONTHS[m - 1]} you said:`;
}

/** The whole quote-back sentence. */
export function whyMessage(motivation: string, at: string | undefined): string {
  return `${whyLead(at)} “${motivation}”. Still true?`;
}

/**
 * Did a run of {@link WHY_LAPSE_RUN}+ kept days lapse yesterday? Yesterday not
 * kept (and not a paused rough day), today not kept yet, and the day before
 * yesterday the end of a run that long, counted over kept days only.
 */
export function runJustLapsed(
  kept: readonly string[] | undefined,
  paused: readonly string[] | undefined,
  today: string,
): boolean {
  const keptSet = new Set(kept ?? []);
  const pausedSet = new Set(paused ?? []);
  const yesterday = shiftDay(today, -1);
  if (keptSet.has(today) || keptSet.has(yesterday) || pausedSet.has(yesterday)) return false;
  let run = 0;
  let d = shiftDay(today, -2);
  for (let guard = 0; guard < 400; guard++) {
    if (keptSet.has(d)) run++;
    else if (!pausedSet.has(d)) break;
    if (run >= WHY_LAPSE_RUN) return true;
    d = shiftDay(d, -1);
  }
  return false;
}

/**
 * May the words be quoted now? Needs words, a wobbly moment, and a month since
 * the last quote. A quote shown earlier TODAY may stay on screen until answered.
 */
export function whyDue(input: {
  motivation: string | undefined;
  quotedAt: string | undefined;
  wobbly: boolean;
  today: string;
}): boolean {
  const { motivation, quotedAt, wobbly, today } = input;
  if (!motivation?.trim() || !wobbly) return false;
  const last = quotedAt ? wallClockOf(quotedAt)?.date : null;
  if (!last || last === today) return true;
  return daysFrom(last, today) >= WHY_QUOTE_GAP_DAYS;
}
