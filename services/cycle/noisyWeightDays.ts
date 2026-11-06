/**
 * services/cycle/noisyWeightDays.ts — what the daily learning job is told.
 *
 * `health-os/` must never import this module (the dependency runs one way), so
 * the app layer asks here and passes the answer into `runDailyLearning` from
 * both of its call sites: the boot path in contexts/AppContext and the interval
 * sweep in contexts/domain/useDayChange. See ./water for what the days are.
 *
 * Reads the log itself rather than the provider's view: the boot path runs
 * before any provider has finished loading.
 */
import type { UserBio } from "../../models/user";
import { loadBodyLogs } from "../BodyLogService";
import { KEYS, readJSON } from "../OfflineStorage";
import { loadCycleData, withCycleLock } from "./store";
import { computeView } from "./view";

/** Never throws: with nothing to say, the scale is simply read as it is. */
export async function loadNoisyWeightDates(today: string): Promise<string[]> {
  try {
    const data = await withCycleLock(() => loadCycleData());
    if (!data.settings.enabled) return [];
    const [bio, logs] = await Promise.all([
      readJSON<Partial<UserBio> | null>(KEYS.USER_BIO, null),
      loadBodyLogs(),
    ]);
    return computeView(data, {
      today,
      profile: { age: bio?.age ?? null, conditions: bio?.medicalConditions ?? [] },
      weighIns: logs.map((l) => ({ date: l.date, kg: l.weightKg })),
    }).noisyWeightDates;
  } catch {
    return [];
  }
}
