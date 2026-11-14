/**
 * GOZLIN AGENT — what the learning models have earned the right to say.
 *
 * health-os/learning refits its models once a day (engine.ts → the rollover):
 * maintenance calories from intake against how the scale really moved, a
 * personal fatigue curve, the days training tends to slip, which kind of nudge
 * lands, and genuine shifts in behaviour. The Memory screen showed all of it.
 * The coach saw none of it — it answered "why isn't my weight moving?" from the
 * signup formula while the app held a better answer two folders away.
 *
 * This file turns the snapshot into one brief. The state block renders it and
 * grounding reads it — the same object for both, like the cycle brief — so a
 * figure shown is a figure the model may quote, and nothing else is.
 *
 * Every gate is the model's own. Nothing here lowers one: an estimate that has
 * not passed its gate is absent, or reported only as "still learning".
 */

import type { ArmId, IntelligenceSnapshot } from "../../../health-os";

/**
 * Weigh-ins the calorie model needs before it may be confident — tdee.ts
 * MIN_OBSERVATIONS (not exported there; engine.ts mirrors it the same way).
 * Confidence ALSO needs the uncertainty to settle, so reaching this number
 * alone does not make the estimate sayable.
 */
const TDEE_MIN_WEIGH_INS = 14;

/** Resolved outcomes before the delivery model stops being its prior (engine.ts DELIVERY_GATE). */
const DELIVERY_MIN_RESOLVED = 20;

/**
 * How recent a behaviour shift must be to still be news. The detector reports
 * the first crossing in the whole history, and "something changed in March" is
 * not what a coach brings up in November.
 */
const SHIFT_RECENT_DAYS = 28;

export interface LearnedBrief {
  /**
   * Maintenance as their own logs imply it, once the calorie model is
   * confident. It blends real burn with how fully they log food (tdee.ts), so
   * it is never a measurement of their metabolism.
   */
  maintenance?: {
    kcal: number;
    plusMinus: number;
    /** The signup formula's figure, or null without a profile to compute it. */
    signupKcal: number | null;
    weighIns: number;
  };
  /** The calorie model is not confident yet — how far it has got. */
  maintenanceLearning?: {
    weighIns: number;
    /** Weigh-ins still short of the minimum, or null once past it (it is the spread that has to settle). */
    needed: number | null;
  };
  /** Their own fatigue curve, once enough sessions fitted it. */
  training?: { fatigueClearsDays: number; sessions: number };
  /** The adherence model, past its own gate, reads tomorrow as a likely miss. */
  tomorrowAtRisk?: true;
  /** The kind of nudge their past responses favour, once there is evidence. */
  approach?: ArmId;
  /** A genuine recent change in behaviour, not a bad week. */
  shift?: { area: string; direction: "decline" | "improve"; daysAgo: number };
}

/** Whole days from `from` to `to`, both YYYY-MM-DD local dates. */
function daysBetween(from: string, to: string): number | null {
  const parse = (s: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Snapshot → brief. Returns undefined when there is nothing worth a line, so
 * the state block stays exactly as it was for someone the models don't know yet.
 */
export function buildLearnedBrief(
  snap: IntelligenceSnapshot | null | undefined,
  opts: { today: string },
): LearnedBrief | undefined {
  if (!snap || !snap.ready) return undefined;
  const brief: LearnedBrief = {};

  const tdee = snap.tdee;
  if (tdee?.confident) {
    brief.maintenance = {
      kcal: tdee.learned,
      plusMinus: tdee.uncertainty,
      signupKcal: tdee.mifflin > 0 ? tdee.mifflin : null,
      weighIns: tdee.observations,
    };
  } else {
    const weighIns = tdee?.observations ?? 0;
    brief.maintenanceLearning = {
      weighIns,
      needed: weighIns < TDEE_MIN_WEIGH_INS ? TDEE_MIN_WEIGH_INS : null,
    };
  }

  if (snap.training.fitted) {
    brief.training = {
      fatigueClearsDays: snap.training.tau2,
      sessions: snap.training.sessions,
    };
  }

  // decide() already refuses to say "shrink" below its sample floor, so the
  // action IS the gate — read it rather than re-deriving a threshold here.
  if (snap.adherence.action.kind === "shrink") brief.tomorrowAtRisk = true;

  if (snap.delivery.best && snap.outcomes.resolved >= DELIVERY_MIN_RESOLVED) {
    brief.approach = snap.delivery.best.arm;
  }

  const drift = snap.drift;
  if (drift?.date) {
    const daysAgo = daysBetween(drift.date, opts.today);
    if (daysAgo !== null && daysAgo >= 0 && daysAgo <= SHIFT_RECENT_DAYS) {
      brief.shift = { area: drift.label, direction: drift.direction, daysAgo };
    }
  }

  return brief;
}

const APPROACH: Record<ArmId, string> = {
  "nudge:direct": "a plain, direct push",
  "nudge:gentle": "a gentle nudge",
  "nudge:question": "a question rather than an instruction",
  "nudge:celebrate": "noticing what went right first",
  "nudge:silence": "less pushing: fewer nudges have landed better than more",
};

/**
 * The block's lines. Every figure in them is a field of the brief, and the
 * agent loop adds the brief to the grounding set and the receipt ledger — so
 * "about 2,240 by your logs" is citable exactly when it was shown.
 */
export function learnedStateLines(brief?: LearnedBrief): string[] {
  if (!brief) return [];
  const lines: string[] = [];

  const m = brief.maintenance;
  if (m) {
    const signup = m.signupKcal !== null ? `; the signup formula said ${m.signupKcal}` : "";
    lines.push(
      `- maintenance by their logs: about ${m.kcal} kcal/day (±${m.plusMinus}), learned from ${m.weighIns} weigh-ins against what they logged eating${signup}.`,
      '  It mixes their real burn with how fully they log food, so say "by your logs", never "you burn" or "your metabolism is".',
      "  Their calorie targets are still set from the signup formula, not from this. Use it to explain progress; never tell them to eat below their target because of it.",
    );
  }

  const l = brief.maintenanceLearning;
  if (l) {
    const progress =
      l.needed !== null
        ? `${l.weighIns} of the ${l.needed} weigh-ins it needs`
        : `${l.weighIns} weigh-ins so far, not settled enough yet to trust`;
    lines.push(
      `- their own maintenance is not learned yet (${progress}); until it is, everything uses the signup formula.`,
      "  If they ask why their weight is not moving as planned, regular weigh-ins and complete food logs are what sharpen it.",
    );
  }

  const t = brief.training;
  if (t) {
    lines.push(
      `- their fatigue from a session clears in about ${t.fatigueClearsDays} days (fitted from ${t.sessions} of their sessions; the average person differs).`,
    );
  }

  if (brief.tomorrowAtRisk) {
    lines.push(
      "- their pattern marks tomorrow as a day training often slips. If you suggest tomorrow's plan, make it smaller and easy to start. Never tell them they are likely to miss it.",
    );
  }

  if (brief.approach) {
    lines.push(
      `- what has landed with them before: ${APPROACH[brief.approach]} (learned from how they responded to past reminders). Lean that way in tone; it never changes the facts.`,
    );
  }

  const s = brief.shift;
  if (s) {
    const when = s.daysAgo <= 2 ? "in the last couple of days" : `about ${s.daysAgo} days ago`;
    lines.push(
      s.direction === "decline"
        ? `- a real drop in ${s.area} began ${when}, and it has held: not a one-off. Bring it up only if it bears on what they asked, and never as a reproach; ask what changed.`
        : `- ${s.area} genuinely picked up ${when}, and it has held: not just a good week. Credit it plainly if it fits.`,
    );
  }

  if (lines.length === 0) return [];
  return [
    "",
    "WHAT THE APP HAS LEARNED ABOUT THEM (refitted daily from their own history; you may cite these figures):",
    ...lines,
  ];
}
