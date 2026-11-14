/**
 * services/export/gather.ts — the stored records "Download my data" reads itself.
 *
 * What the screens already hold (profile, weigh-ins, closed days, workouts,
 * habits, the cycle log) is handed in by the component from the app's state, so
 * the copy matches what is on screen. Everything else is read here from the
 * stores that own it, through their own readers. Each read is separate and
 * fails soft: one unreadable store leaves its section empty, never the file.
 */
import { loadFitnessProfile } from "../../fitness/services/FitnessProfileStore";
import type { EffortMemory, PainMemory } from "../../fitness/types";
import {
  loadArchive,
  loadCheckins,
  loadConversation,
  loadEpisodes,
  loadIdentity,
} from "../gozlin/GozlinMemoryStore";
import type { IntakeRecord } from "../nutrition/IntakeLedger";
import { readStore } from "../nutrition/foodLogStore";
import { KEYS, getWaterHistory, readJSON } from "../OfflineStorage";
import type { ExportMeal, ExportMood, MyDataInput } from "./myData";

export interface StoredExportData {
  meals: ExportMeal[];
  water: MyDataInput["water"];
  moods: ExportMood[];
  effort: EffortMemory[];
  pain: PainMemory[];
  coach: MyDataInput["coach"];
}

async function soft<T>(read: () => Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await read();
  } catch (e) {
    console.log(`[export] could not read ${what}`, e);
    return fallback;
  }
}

async function readMeals(): Promise<ExportMeal[]> {
  const [ledger, logs] = await Promise.all([
    soft(() => readJSON<Record<string, IntakeRecord[]>>(KEYS.INTAKE_LEDGER, {}), {}, "the meal ledger"),
    soft(() => readStore(), {}, "the food log"),
  ]);
  const meals: ExportMeal[] = [];
  for (const [date, records] of Object.entries(ledger)) {
    if (!Array.isArray(records)) continue;
    for (const r of records) {
      meals.push({ date, slot: r.slot ?? null, name: r.name, kcal: r.calories ?? null, source: "plan" });
    }
  }
  for (const [date, entries] of Object.entries(logs)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      meals.push({ date, slot: e.slot ?? null, name: e.label, kcal: e.totals?.calories ?? null, source: "log" });
    }
  }
  return meals;
}

export async function gatherStoredData(): Promise<StoredExportData> {
  const [meals, water, checkins, profile, identity, episodes, current, archive] = await Promise.all([
    readMeals(),
    soft(() => getWaterHistory(), [], "water history"),
    soft(() => loadCheckins(), [], "check-ins"),
    soft(() => loadFitnessProfile(), null, "the fitness profile"),
    soft(() => loadIdentity(), null, "Gozlin's identity memory"),
    soft(() => loadEpisodes(), [], "Gozlin's moments"),
    soft(() => loadConversation(), [], "the current conversation"),
    soft(() => loadArchive(), [], "past conversations"),
  ]);

  const conversations = archive.map((a) => ({ startedAt: a.startedAt, messages: a.messages }));
  if (current.length) {
    conversations.push({ startedAt: current[0].createdAt, messages: current });
  }

  return {
    meals,
    water,
    moods: checkins,
    effort: profile?.effortHistory ?? [],
    pain: profile?.painHistory ?? [],
    coach: {
      motivation: identity?.motivation,
      preferences: identity?.preferences ?? [],
      constraints: identity?.constraints ?? [],
      episodes: episodes.map((e) => ({ date: e.date, summary: e.summary })),
      conversations,
    },
  };
}
