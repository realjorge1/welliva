/**
 * MOMENT VOICE — the many ways to say one true thing.
 *
 * WHY THIS EXISTS. Every nudge on Home is a counted fact about this user, and
 * for a long time each kind of fact had exactly ONE sentence. That is fine the
 * first time you read it and corrosive by the tenth: "5 done. Your best week
 * ever is 5." followed a week later by "6 done. Your best week ever is 6." is
 * the same string with the numbers swapped, and a person reads that as a
 * template, not as their coach. A surface that is genuinely watching you should
 * not sound like a mail merge of itself.
 *
 * So the numbers stay fixed and the WORDS around them move. Every pool below is
 * a set of phrasings for the identical fact — same figures, same claim, no
 * exaggeration between variants. Nothing here invents, rounds, or projects; the
 * caller does all the counting and hands the numbers in.
 *
 * DETERMINISTIC, NOT RANDOM. `Math.random()` would reshuffle the card on every
 * re-render, which reads as a glitch rather than as variety. Instead each
 * phrasing is picked by hashing a SEED built from the facts themselves — so the
 * line is rock-steady for as long as the fact is, and changes the moment the
 * fact does. Log a session and the card genuinely has something new to say, in
 * new words.
 *
 * Headline and detail are drawn with different seeds, so the two rotate
 * independently and the pools multiply rather than add: 32 × 32 is a thousand
 * distinct cards from sixty-four strings.
 */

/* ───────────────────────────── picking ─────────────────────────────────── */

/** FNV-1a, 32-bit. Small, fast, and stable across platforms and launches. */
export function seedHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The phrasing this fact gets. Same seed in, same phrasing out, forever. */
export function pickPhrase<T>(pool: readonly T[], seed: string): T {
  return pool[seedHash(seed) % pool.length];
}

/* ───────────────────────────── grammar ─────────────────────────────────── */

/** "1 session" → "one session". Words for small counts read as speech. */
function sessions(n: number): string {
  return n === 1 ? "one session" : `${n} sessions`;
}

/** Capitalised, for the head of a sentence. */
function Sessions(n: number): string {
  return n === 1 ? "One session" : `${n} sessions`;
}

function days(n: number): string {
  return n === 1 ? "one day" : `${n} days`;
}

function Days(n: number): string {
  return n === 1 ? "One day" : `${n} days`;
}

/* ─────────────────────────── week: the chase ────────────────────────────
 * Facts available: `week` sessions logged so far this week, `best` is the most
 * in any COMPLETED week the user has ever had, `target` = best + 1 (the number
 * that makes this the biggest week they've had), `remaining` = target − week.
 * Every line below is true of exactly those numbers and claims nothing else.
 */

export interface WeekFacts {
  /** Sessions logged in the week in progress. */
  week: number;
  /** Most sessions in any completed week — the record being chased or held. */
  best: number;
  /** Sessions needed for this to be the biggest week. */
  target: number;
  /** target − week, when still chasing. */
  remaining: number;
}

export const WEEK_CHASE_HEADLINES: readonly ((f: WeekFacts) => string)[] = [
  (f) => `${Sessions(f.remaining)} from your biggest week`,
  (f) => `${Sessions(f.remaining)} to your best week ever`,
  (f) => `Your biggest week is ${sessions(f.remaining)} away`,
  (f) => `${Sessions(f.remaining)} left to top your record`,
  (f) => `Beat your record with ${sessions(f.remaining)}`,
  (f) => `A record week sits ${sessions(f.remaining)} out`,
  (f) => `${Sessions(f.remaining)} and this is your best week`,
  (f) => `Your best week is within ${sessions(f.remaining)}`,
  (f) => `${Sessions(f.remaining)} from rewriting your best week`,
  (f) => `${Sessions(f.remaining)} short of your biggest week`,
  (f) => `Close now — ${sessions(f.remaining)} to the record`,
  (f) => `${Sessions(f.remaining)} to go for a new best week`,
  (f) => `Your biggest week wants ${sessions(f.remaining)} more`,
  (f) => `One record week, ${sessions(f.remaining)} away`,
  (f) => `${Sessions(f.remaining)} from the best week you've logged`,
  (f) => `${Sessions(f.remaining)} more and the record is yours`,
  (f) => `Record week in reach — ${sessions(f.remaining)} to go`,
  (f) => `${Sessions(f.remaining)} from your heaviest week yet`,
  (f) => `Your best week ever: ${sessions(f.remaining)} out`,
  (f) => `${Sessions(f.remaining)} between you and a personal best`,
  (f) => `${Sessions(f.remaining)} and you've never done better`,
  (f) => `${Sessions(f.remaining)} from a week you've never had`,
  (f) => `${Sessions(f.remaining)} to outdo your best week`,
  (f) => `The record week is ${sessions(f.remaining)} off`,
  (f) => `${Sessions(f.remaining)} away from ${f.target}`,
  (f) => `${f.target} would be a first — ${sessions(f.remaining)} to go`,
  (f) => `${Sessions(f.remaining)} clear of your ceiling`,
  (f) => `Your ceiling is ${sessions(f.remaining)} above you`,
  (f) => `${Sessions(f.remaining)} from the top of your own list`,
  (f) => `${Sessions(f.remaining)} until this week leads them all`,
  (f) => `${Sessions(f.remaining)} to make this the one`,
  (f) => `${Sessions(f.remaining)} and the week is a record`,
];

export const WEEK_CHASE_DETAILS: readonly ((f: WeekFacts) => string)[] = [
  (f) => `${f.week} done this week. Your best week ever is ${f.best}.`,
  (f) => `${f.week} logged. ${f.target} has never happened.`,
  (f) => `You're on ${f.week}. The record is ${f.best}.`,
  (f) => `${f.week} in. No week of yours has passed ${f.best}.`,
  (f) => `${f.week} so far — ${f.target} would be new ground.`,
  (f) => `Best week on record: ${f.best}. This week: ${f.week}.`,
  (f) => `${f.week} sessions banked against a record of ${f.best}.`,
  (f) => `${f.week} down. ${f.best} is the number to pass.`,
  (f) => `Your top week is ${f.best}. You're sitting on ${f.week}.`,
  (f) => `${f.week} this week; ${f.best} is the most you've ever managed.`,
  (f) => `${f.target} sessions has never been done here. You're at ${f.week}.`,
  (f) => `${f.week} logged, ${f.remaining} to clear ${f.best}.`,
  (f) => `The bar is ${f.best}. You're ${f.week} into this week.`,
  (f) => `${f.week} in the book. Nothing above ${f.best} yet.`,
  (f) => `${f.week} sessions. Your record week held ${f.best}.`,
  (f) => `Record: ${f.best}. Right now: ${f.week}.`,
  (f) => `${f.week} of ${f.target}. The last ${f.remaining} is the new part.`,
  (f) => `${f.best} is your high-water mark. You're at ${f.week}.`,
  (f) => `${f.week} done, and ${f.best} still stands.`,
  (f) => `You've never logged more than ${f.best} in a week. You're on ${f.week}.`,
  (f) => `${f.week} this week versus ${f.best} at your best.`,
  (f) => `${f.remaining} more takes you past ${f.best}.`,
  (f) => `${f.week} sessions in — one week of yours ever went to ${f.best}.`,
  (f) => `${f.week} logged. Beat ${f.best} and it's a new record.`,
  (f) => `Standing record ${f.best}. This week so far ${f.week}.`,
  (f) => `${f.week} completed. ${f.target} is uncharted.`,
  (f) => `${f.best} was the peak. ${f.week} is today's count.`,
  (f) => `${f.week} in, ${f.remaining} to write a new best.`,
  (f) => `Your busiest week ever ran to ${f.best}. This one's at ${f.week}.`,
  (f) => `${f.week} sessions logged; ${f.best} is what there is to beat.`,
  (f) => `${f.week} so far. ${f.best} is the record, ${f.target} breaks it.`,
  (f) => `${f.week} of your own ${f.target}-session ceiling.`,
];

/* ─────────────────────── week: the record, held ─────────────────────────
 * `week` is now above `best` — the record is broken and the bar is full. These
 * lines state that and nothing more: no "keep going", no projection to a number
 * the user hasn't reached. `best` is the OLD record, which is exactly why the
 * engine keeps its own copy rather than reading a live "best ever".
 */

export const WEEK_RECORD_HEADLINES: readonly ((f: WeekFacts) => string)[] = [
  () => `Personal best`,
  () => `Your biggest week`,
  () => `New record week`,
  () => `Record broken`,
  () => `Best week you've had`,
  () => `You've never done this much`,
  (f) => `${f.week} — a record`,
  () => `Top of your own list`,
  () => `A week without precedent`,
  () => `Nothing you've logged beats this`,
  () => `The record is yours`,
  () => `Past your best`,
  () => `New high-water mark`,
  () => `This is the biggest one`,
  () => `Your best week, now`,
  (f) => `${f.week} sessions — a first`,
  () => `A first for you`,
  () => `The ceiling moved`,
  () => `You raised your own bar`,
  () => `Above everything before it`,
  () => `Best week on record`,
  () => `Record week, done`,
  () => `You've outdone yourself`,
  () => `Your heaviest week yet`,
  () => `No week of yours was bigger`,
  () => `A new personal best`,
  () => `Straight past the record`,
  () => `This week leads them all`,
  () => `Your new best`,
  () => `Record week secured`,
  () => `Better than any week before`,
  () => `The old number is gone`,
];

export const WEEK_RECORD_DETAILS: readonly ((f: WeekFacts) => string)[] = [
  (f) => `${f.week} sessions this week. Your old record was ${f.best}.`,
  (f) => `${f.week} done — past your previous best of ${f.best}.`,
  (f) => `You've beaten ${f.best}. This week stands at ${f.week}.`,
  (f) => `${f.week} logged, and the record you broke was ${f.best}.`,
  (f) => `Old best ${f.best}. New best ${f.week}.`,
  (f) => `${f.week} sessions — no week of yours ever passed ${f.best} before.`,
  (f) => `${f.best} held for a while. ${f.week} takes it.`,
  (f) => `That's ${f.week}, against a standing record of ${f.best}.`,
  (f) => `${f.week} this week. The number to beat was ${f.best}.`,
  (f) => `You went from ${f.best} at your best to ${f.week}.`,
  (f) => `${f.week} sessions logged. Previous best: ${f.best}.`,
  (f) => `${f.week} — ${f.week - f.best} more than you've ever done in a week.`,
  (f) => `Every earlier week topped out at ${f.best}. This one's on ${f.week}.`,
  (f) => `${f.week} banked. ${f.best} was the old ceiling.`,
  (f) => `Record was ${f.best}; you're at ${f.week} and the week isn't over.`,
  (f) => `${f.week} sessions. Nothing in your log comes above that.`,
  (f) => `${f.best} → ${f.week}. That's the whole story.`,
  (f) => `You've logged ${f.week} this week, clear of your ${f.best}.`,
  (f) => `${f.week} done. The previous high was ${f.best}.`,
  (f) => `Your ${f.best}-session best just became ${f.week}.`,
  (f) => `${f.week} sessions — a number this log has never held.`,
  (f) => `Beaten: ${f.best}. Current: ${f.week}.`,
  (f) => `${f.week} logged, and it's the most you've ever done in seven days.`,
  (f) => `The bar was ${f.best}. You put it at ${f.week}.`,
  (f) => `${f.week} sessions this week, past ${f.best} and still counting.`,
  (f) => `${f.week} in. Every other week of yours stopped at ${f.best} or less.`,
  (f) => `Your best week was ${f.best} sessions. It's ${f.week} now.`,
  (f) => `${f.week} — you cleared ${f.best}.`,
  (f) => `${f.week} sessions. The old record, ${f.best}, is history.`,
  (f) => `${f.week} done this week, against ${f.best} at your previous peak.`,
  (f) => `From ${f.best} to ${f.week}, counted off your own log.`,
  (f) => `${f.week} sessions logged — your record, and you set it.`,
];

/* ───────────────────────── streak: the chase ────────────────────────────
 * `current` days running, `best` is the longest streak ever, `away` is how many
 * more days it takes to BEAT it (inclusive of the day that ties).
 */

export interface StreakFacts {
  current: number;
  best: number;
  away: number;
}

export const STREAK_HEADLINES: readonly ((f: StreakFacts) => string)[] = [
  (f) => `${Days(f.away)} from your record`,
  (f) => `${Days(f.away)} to your longest streak`,
  (f) => `Your record is ${days(f.away)} out`,
  (f) => `${Days(f.away)} and it's your longest ever`,
  (f) => `${Days(f.away)} from the longest you've held`,
  (f) => `Longest streak: ${days(f.away)} away`,
  (f) => `${Days(f.away)} to beat your own record`,
  (f) => `${Days(f.away)} short of your best run`,
  (f) => `${Days(f.away)} left on the record`,
  (f) => `Your best run is ${days(f.away)} ahead`,
  (f) => `${Days(f.away)} until you've never gone longer`,
  (f) => `${Days(f.away)} from a new longest streak`,
  (f) => `${Days(f.away)} between you and the record`,
  (f) => `Record streak in ${days(f.away)}`,
  (f) => `${Days(f.away)} to pass ${f.best}`,
  (f) => `${Days(f.away)} more than you've ever needed`,
  (f) => `${Days(f.away)} and the streak is a record`,
  (f) => `${Days(f.away)} to the top of your streaks`,
  (f) => `Your longest run is ${days(f.away)} off`,
  (f) => `${Days(f.away)} from rewriting your streak`,
  (f) => `${Days(f.away)} out from your best streak`,
  (f) => `${Days(f.away)} to outlast your record`,
  (f) => `${Days(f.away)} and you're past ${f.best}`,
  (f) => `${Days(f.away)} to your own high mark`,
];

export const STREAK_DETAILS: readonly ((f: StreakFacts) => string)[] = [
  (f) => `You're on ${f.current}. Your longest ever is ${f.best}.`,
  (f) => `${f.current} days running against a record of ${f.best}.`,
  (f) => `${f.current} in a row. ${f.best} is the number to pass.`,
  (f) => `Current run ${f.current}, longest ever ${f.best}.`,
  (f) => `${f.current} days held. You've never gone past ${f.best}.`,
  (f) => `${f.best} is your record. You're ${f.current} deep.`,
  (f) => `${f.current} straight days. The bar is ${f.best}.`,
  (f) => `You've kept ${f.current} going. ${f.best} was the peak.`,
  (f) => `${f.current} days. Your best streak ran to ${f.best}.`,
  (f) => `Standing record ${f.best}; you're at ${f.current}.`,
  (f) => `${f.current} unbroken. ${f.best + 1} would be a first.`,
  (f) => `${f.current} logged in a row against ${f.best} at your best.`,
  (f) => `Your longest run was ${f.best}. This one's at ${f.current}.`,
  (f) => `${f.current} days, ${f.away} from clearing ${f.best}.`,
  (f) => `${f.current} down. Nothing you've done beats ${f.best} yet.`,
  (f) => `${f.best} days is the record. You're holding ${f.current}.`,
  (f) => `${f.current} consecutive. Previous best ${f.best}.`,
  (f) => `You're ${f.current} in; ${f.best} is what there is to beat.`,
  (f) => `${f.current} days on. Your high mark is ${f.best}.`,
  (f) => `${f.current} kept. ${f.best} is the longest you've ever kept.`,
  (f) => `${f.current} running, ${f.best} to beat.`,
  (f) => `Best streak ${f.best}. Live streak ${f.current}.`,
  (f) => `${f.current} days without a gap, against ${f.best}.`,
  (f) => `${f.current} so far — ${f.best} is the record you set.`,
];

/* ──────────────────── lifetime days: the round number ───────────────────
 * `total` active days logged, `milestone` the round number in sight, `away` the
 * days left. The quietest of the three, and the only one whose target is not
 * derived from the user's own history — so its phrasings stay plain.
 */

export interface DaysFacts {
  total: number;
  milestone: number;
  away: number;
}

export const DAYS_HEADLINES: readonly ((f: DaysFacts) => string)[] = [
  (f) => `${Days(f.away)} from ${f.milestone}`,
  (f) => `${Days(f.away)} to ${f.milestone} active days`,
  (f) => `${f.milestone} is ${days(f.away)} out`,
  (f) => `${Days(f.away)} short of ${f.milestone}`,
  (f) => `${Days(f.away)} until ${f.milestone}`,
  (f) => `${f.milestone} active days, ${days(f.away)} away`,
  (f) => `${Days(f.away)} left to ${f.milestone}`,
  (f) => `${Days(f.away)} and you hit ${f.milestone}`,
  (f) => `${f.milestone} in ${days(f.away)}`,
  (f) => `${Days(f.away)} off ${f.milestone}`,
  (f) => `Closing on ${f.milestone} — ${days(f.away)} to go`,
  (f) => `${Days(f.away)} to your ${f.milestone}th`,
  (f) => `${f.milestone} days logged is ${days(f.away)} ahead`,
  (f) => `${Days(f.away)} more makes ${f.milestone}`,
  (f) => `${f.milestone} is nearly here — ${days(f.away)}`,
  (f) => `${Days(f.away)} between you and ${f.milestone}`,
];

export const DAYS_DETAILS: readonly ((f: DaysFacts) => string)[] = [
  (f) => `${f.total} active days logged so far.`,
  (f) => `${f.total} days on the board.`,
  (f) => `You've logged something on ${f.total} days.`,
  (f) => `${f.total} days counted, ${f.away} to go.`,
  (f) => `That's ${f.total} days of showing up.`,
  (f) => `${f.total} down, ${f.milestone} in sight.`,
  (f) => `${f.total} active days behind you.`,
  (f) => `${f.total} days logged since you started.`,
  (f) => `Running total: ${f.total} active days.`,
  (f) => `${f.total} days recorded, ${f.away} short of ${f.milestone}.`,
  (f) => `${f.total} days of real entries.`,
  (f) => `You've been active on ${f.total} separate days.`,
  (f) => `${f.total} days counted off your own log.`,
  (f) => `${f.total} active days, and ${f.away} left to round it off.`,
  (f) => `${f.total} in the book.`,
  (f) => `${f.total} days logged. ${f.milestone} is the next round one.`,
];
