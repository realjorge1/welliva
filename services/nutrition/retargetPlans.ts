/**
 * RETARGET PLANS — bring the plans in line with new numbers WITHOUT touching
 * anything she has already eaten.
 *
 * `updateUserBio` (a profile edit) regenerates today's plan outright. That's
 * acceptable for a deliberate edit, but a move that happens BY ITSELF (her
 * weight trend, an accepted offer) must be gentler: the intake ledger heals
 * ticks by slot + name, and a regenerated day with different dishes would show
 * this morning's breakfast as un-ticked. So the days are RESIZED, not rebuilt
 * (nutrition/portionSolver): same dishes, same names, new servings.
 *
 *   · today is resized only while nothing on it is eaten — no tick on the plan
 *     and no line in the intake ledger;
 *   · every stored day to come is resized in place (an AI-written day stays
 *     the AI's dishes, and costs no new request);
 *   · her own hand-picked menu days are hers: never resized here (she chose
 *     their amounts on the picker's servings dial).
 *
 * Never throws: the numbers have already changed, and a failure here must not
 * undo that or reach the screen. It logs once.
 */
import type { DaySchedule } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { UserBio } from "../../models/user";
import { isCustomSchedule } from "../CustomMenuSchedule";
import { fitScheduleToTargets } from "../DietPlanGenerator";
import {
  applyDaySchedules,
  getScheduleForDate,
  getScheduledDates,
  getStoredSchedules,
} from "../ScheduleService";
import { getIntakeForDate } from "./IntakeLedger";

let logged = false;

const eatenOn = (s: DaySchedule) =>
  [s.breakfast, s.lunch, s.dinner, ...(s.snacks ?? [])].some((m) => m?.isConsumed);

export async function refitPlansToTargets(
  bio: UserBio,
  targets: NutritionTargets,
  today: string,
): Promise<void> {
  try {
    const save: DaySchedule[] = [];

    const schedule = await getScheduleForDate(today);
    const records = await getIntakeForDate(today);
    if (schedule && !eatenOn(schedule) && records.length === 0 && !isCustomSchedule(schedule)) {
      save.push(fitScheduleToTargets(schedule, bio, targets));
    }

    const ahead = (await getScheduledDates()).filter((d) => d > today);
    if (ahead.length > 0) {
      const stored = await getStoredSchedules(ahead);
      for (const day of stored.values()) {
        if (isCustomSchedule(day) || eatenOn(day)) continue;
        save.push(fitScheduleToTargets(day, bio, targets));
      }
    }

    if (save.length > 0) await applyDaySchedules({ save, clear: [] });
  } catch (e) {
    if (!logged) {
      logged = true;
      console.log("refitPlansToTargets: plans kept as they were", e);
    }
  }
}
