/**
 * CARE FLAGS — what Gozlin remembers about a safety signal, and nothing more.
 *
 * The clinical screen (agent/clinical.ts) reads one message at a time and
 * forgets. That is right for a referral and wrong for a feature that asks
 * "how did you feel after eating X?": a question that teaches someone to sort
 * food into good and bad is harmless to most people and harmful to exactly the
 * person who, three weeks ago, said they make themselves sick after meals.
 *
 * So a disordered-eating signal leaves a flag: its KIND and WHEN, never the
 * words (the owner's call, 2026-09-27 — docs/gozlin/11 §9, D3). While a flag is
 * active, every food follow-up is off. It lasts CARE_FLAG_DAYS, and "Clear
 * memory" clears it with everything else Gozlin remembers.
 *
 * Phase 1 has no food follow-ups at all; the flag is recorded from now so that
 * when Phase 2 ships, the signals of the months before it are already there.
 *
 * Pure. Storage lives in ExperienceStore.
 */

export type CareFlagKind = "disordered_eating";

export interface CareFlag {
  kind: CareFlagKind;
  /** ISO. The only other thing kept — no text, no message, no context. */
  at: string;
}

export const CARE_FLAG_DAYS = 180;

export function activeCareFlags(flags: readonly CareFlag[], now: Date): CareFlag[] {
  const cutoff = now.getTime() - CARE_FLAG_DAYS * 86_400_000;
  return flags.filter((f) => {
    const t = Date.parse(f.at);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Must every food follow-up stay off? True while any disordered-eating flag is live. */
export function foodFollowupsBlocked(flags: readonly CareFlag[], now: Date): boolean {
  return activeCareFlags(flags, now).some((f) => f.kind === "disordered_eating");
}
