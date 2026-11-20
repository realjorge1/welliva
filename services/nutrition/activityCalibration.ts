/**
 * ACTIVITY CALIBRATION — her logged training, offered as her activity level.
 *
 * The activity level she chose at onboarding used to stay for ever, so her
 * real training never moved her target. MyFitnessPal and Lose It! add exercise
 * calories back on the day — but the activity levels ALREADY include exercise
 * ("moderate: exercise 3–5 days a week"), so adding it back counts it twice.
 * The owner chose (2026-11-20) the honest version: after CALIBRATION_WEEKS of
 * consistent logging that disagrees with her stated level, OFFER one step up
 * or down, with what her calories would become. One tap; remembered if she
 * declines.
 *
 * What counts as evidence:
 *  · every one of the last 4 weeks has at least one logged session, and the
 *    weeks are steady (no week more than MAX_WEEKLY_SWING sessions off another)
 *    — someone logging in bursts, or who stopped, is telling us about her
 *    logging, not her week, so nothing is offered;
 *  · sessions per week map onto the ladder (0–1 sedentary, 1–3 light,
 *    3–5 moderate, 6–7 active) and the offer is ONE step toward it;
 *  · "very active" is never offered: it means a physical job as well as daily
 *    training, which no workout log can see — and nobody on it is offered a
 *    step down either, for the same reason.
 *
 * Silent once the learning model is confident: it already measures her real
 * burn from intake and weight, and the two must never both act. No offer for
 * anyone under 18, pregnant, postpartum or underweight (no adaptive changes).
 *
 * Note the scale: migration 003 renamed the tiers, so `active` (1.725) is the
 * old "very active" and `very_active` (1.9) is the new extra tier.
 */
import type { ActivityLevel, UserBio } from "../../models/user";
import type { WorkoutLogEntry } from "../../models/workout";
import { calculateNutritionTargets } from "../NutritionService";
import { KEYS, readJSON } from "../OfflineStorage";
import { learningConfident } from "./adaptiveTargets";
import { noCutReason } from "./pace";
import { loadOffers, makeOffer, offeredWithin, saveOffer, type TargetOffer } from "./targetOffers";
import { RETARGET_KCAL } from "./weightRetarget";

/** Weeks of logging an offer is read from. */
export const CALIBRATION_WEEKS = 4;
/** "Steady": no week more than this many sessions off another. */
export const MAX_WEEKLY_SWING = 2;
/** A declined (or accepted) offer isn't repeated for this long. */
export const ACTIVITY_COOLDOWN_DAYS = 28;

/** The ladder an offer may move along (never to or from "very_active"). */
const LADDER: ActivityLevel[] = ["sedentary", "light", "moderate", "active"];

const WORDS: Record<ActivityLevel, string> = {
  sedentary: "mostly sitting",
  light: "light",
  moderate: "moderate",
  active: "active",
  very_active: "very active",
};

/** Sessions a week → the level they describe. */
export function levelForSessions(perWeek: number): ActivityLevel {
  if (perWeek < 1.5) return "sedentary";
  if (perWeek < 3.5) return "light";
  if (perWeek < 5.5) return "moderate";
  return "active";
}

const shift = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(y!, m! - 1, d! + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** Sessions logged in each of the last `weeks` whole weeks before today, oldest first. */
export function weeklySessions(log: readonly Pick<WorkoutLogEntry, "date">[], today: string, weeks = CALIBRATION_WEEKS): number[] {
  const out: number[] = [];
  for (let w = weeks; w >= 1; w--) {
    const from = shift(today, -7 * w);
    const to = shift(today, -7 * (w - 1)); // exclusive: today is never in a closed week
    out.push(log.filter((e) => e.date >= from && e.date < to).length);
  }
  return out;
}

export interface ActivityInput {
  bio: UserBio;
  log: readonly Pick<WorkoutLogEntry, "date">[];
  offers: readonly TargetOffer[];
  /** The learning model is confident about her burn (then this stays silent). */
  learningConfident: boolean;
  today: string;
  now?: Date;
}

/** A one-tap offer of one step along the ladder, or null. */
export function proposeActivityLevel(input: ActivityInput): TargetOffer | null {
  const { bio } = input;
  if (input.learningConfident) return null;
  if (noCutReason(bio) !== null) return null;
  if (bio.activityLevel === "very_active") return null;
  if (input.offers.some((o) => o.id === "activity" && o.status === "pending")) return null;
  if (offeredWithin(input.offers, "activity", input.today, ACTIVITY_COOLDOWN_DAYS)) return null;

  const weeks = weeklySessions(input.log, input.today);
  if (weeks.some((n) => n === 0)) return null; // not logging every week: no evidence
  if (Math.max(...weeks) - Math.min(...weeks) > MAX_WEEKLY_SWING) return null; // not steady
  const perWeek = weeks.reduce((a, b) => a + b, 0) / weeks.length;

  const here = LADDER.indexOf(bio.activityLevel);
  const there = LADDER.indexOf(levelForSessions(perWeek));
  if (here < 0 || there < 0 || here === there) return null;
  const next = LADDER[here + Math.sign(there - here)]!;

  const before = calculateNutritionTargets(bio);
  const after = calculateNutritionTargets({ ...bio, activityLevel: next });
  if (Math.abs(after.calories - before.calories) < RETARGET_KCAL) return null;

  const rounded = Math.round(perWeek * 2) / 2;
  const message =
    `Over the last ${CALIBRATION_WEEKS} weeks you've logged about ${rounded} workouts a week, ` +
    `which fits "${WORDS[next]}" better than "${WORDS[bio.activityLevel]}". ` +
    `New numbers: ${before.calories.toLocaleString()} → ${after.calories.toLocaleString()} kcal a day.`;
  return makeOffer("activity", input.today, before, after, message, { activityLevel: next }, input.now);
}

/** Once a day, after learning: stage an activity offer if one is due. Never throws. */
export async function stageActivityOffer(bio: UserBio, today: string): Promise<void> {
  try {
    const offer = proposeActivityLevel({
      bio,
      log: await readJSON<WorkoutLogEntry[]>(KEYS.WORKOUT_LOG, []),
      offers: await loadOffers(),
      learningConfident: await learningConfident(),
      today,
    });
    if (offer) await saveOffer(offer);
  } catch (e) {
    console.log("stageActivityOffer: nothing offered", e);
  }
}
