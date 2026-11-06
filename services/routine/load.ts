/**
 * services/routine/load.ts
 *
 * The records the routine clock reads, loaded in one pass for a screen to work
 * from. Read-only: nothing here writes, and every read falls back to empty, so
 * a store that cannot be read means "no routine yet", never an error on screen.
 */
import type { WorkoutLogEntry } from "../../models/workout";
import { getWaterHistory, KEYS, readJSON, type WaterHistoryEntry } from "../OfflineStorage";
import { loadCheckins } from "../gozlin/GozlinMemoryStore";
import type { GozlinCheckin } from "../gozlin/gozlin.types";
import type { IntakeLedger } from "../nutrition/IntakeLedger";
import { readStore, type LogStore } from "../nutrition/foodLogStore";
import type { PourLog } from "../nutrition/waterPours";
import { readWaterPours } from "../nutrition/waterStore";
import { loadTickTimes, type HabitTickTime } from "./tickTimes";

export interface RoutineSources {
  tickTimes: HabitTickTime[];
  intake: IntakeLedger;
  foodLog: LogStore;
  waterHistory: WaterHistoryEntry[];
  pours: PourLog | null;
  checkins: GozlinCheckin[];
  workouts: WorkoutLogEntry[];
}

export const EMPTY_ROUTINE_SOURCES: RoutineSources = {
  tickTimes: [],
  intake: {},
  foodLog: {},
  waterHistory: [],
  pours: null,
  checkins: [],
  workouts: [],
};

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return (await read()) ?? fallback;
  } catch {
    return fallback;
  }
}

let inFlight: Promise<RoutineSources> | null = null;

/**
 * The records, read fresh. Several hooks on one screen ask at the same moment,
 * and these are whole-history documents to parse on a low-end phone, so callers
 * that overlap share one read.
 */
export function loadRoutineSources(): Promise<RoutineSources> {
  if (!inFlight) inFlight = readAll().finally(() => (inFlight = null));
  return inFlight;
}

async function readAll(): Promise<RoutineSources> {
  const [tickTimes, intake, foodLog, waterHistory, pours, checkins, workouts] = await Promise.all([
    safe(loadTickTimes, []),
    safe(() => readJSON<IntakeLedger>(KEYS.INTAKE_LEDGER, {}), {}),
    safe(readStore, {}),
    safe(getWaterHistory, []),
    safe(readWaterPours, null),
    safe(loadCheckins, []),
    safe(() => readJSON<WorkoutLogEntry[]>(KEYS.WORKOUT_LOG, []), []),
  ]);
  return {
    tickTimes,
    intake: intake && typeof intake === "object" ? intake : {},
    foodLog: foodLog && typeof foodLog === "object" ? foodLog : {},
    waterHistory: Array.isArray(waterHistory) ? waterHistory : [],
    pours,
    checkins: Array.isArray(checkins) ? checkins : [],
    workouts: Array.isArray(workouts) ? workouts : [],
  };
}
