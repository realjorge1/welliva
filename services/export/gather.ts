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
import { loadExperiences } from "../gozlin/ExperienceStore";
import { derivePastChats, loadForgottenPastChats, pastChatSummary } from "../gozlin/pastChats";
import type { IntakeRecord } from "../nutrition/IntakeLedger";
import { readStore } from "../nutrition/foodLogStore";
import { loadDayComplete } from "../nutrition/dayStatus";
import { loadOffers } from "../nutrition/targetOffers";
import { loadMoves } from "../nutrition/weightRetarget";
import { KEYS, getWaterHistory, readJSON } from "../OfflineStorage";
import type { ExportMeal, ExportMood, MyDataInput } from "./myData";

export interface StoredExportData {
  meals: ExportMeal[];
  water: MyDataInput["water"];
  moods: ExportMood[];
  effort: EffortMemory[];
  pain: PainMemory[];
  coach: MyDataInput["coach"];
  targets: NonNullable<MyDataInput["targets"]>;
}

/** Her target moves, offers and "That's everything" days (services/nutrition). */
async function readTargets(): Promise<StoredExportData["targets"]> {
  const [moves, offers, complete] = await Promise.all([
    soft(() => loadMoves(), [], "target moves"),
    soft(() => loadOffers(), [], "target suggestions"),
    soft(() => loadDayComplete(), {}, "complete days"),
  ]);
  return {
    moves: moves.map((m) => ({ date: m.date, message: m.message })),
    offers: offers.map((o) => ({ date: o.date, kind: o.id, status: o.status, message: o.message })),
    completeDays: Object.entries(complete)
      .filter(([, v]) => v?.complete === true)
      .map(([d]) => d),
  };
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
  const [meals, water, checkins, profile, identity, episodes, current, archive, notes, forgotten] = await Promise.all([
    readMeals(),
    soft(() => getWaterHistory(), [], "water history"),
    soft(() => loadCheckins(), [], "check-ins"),
    soft(() => loadFitnessProfile(), null, "the fitness profile"),
    soft(() => loadIdentity(), null, "Gozlin's identity memory"),
    soft(() => loadEpisodes(), [], "Gozlin's moments"),
    soft(() => loadConversation(), [], "the current conversation"),
    soft(() => loadArchive(), [], "past conversations"),
    soft(() => loadExperiences(), [], "things you tried"),
    soft(() => loadForgottenPastChats(), [], "forgotten chats"),
  ]);
  // The same derivation the coach reads, so the file shows exactly what
  // Gozlin may bring up — nothing it can't.
  const pastChats = derivePastChats({ archive, experiences: notes, identity, forgotten }).map((c) => ({
    day: c.day,
    title: c.title,
    summary: pastChatSummary(c),
  }));

  const conversations = archive.map((a) => ({ startedAt: a.startedAt, messages: a.messages }));
  if (current.length) {
    conversations.push({ startedAt: current[0].createdAt, messages: current });
  }

  const targets = await readTargets();

  return {
    meals,
    water,
    targets,
    moods: checkins,
    effort: profile?.effortHistory ?? [],
    pain: profile?.painHistory ?? [],
    coach: {
      motivation: identity?.motivation,
      preferences: identity?.preferences ?? [],
      constraints: identity?.constraints ?? [],
      episodes: episodes.map((e) => ({ date: e.date, summary: e.summary })),
      conversations,
      pastChats,
    },
  };
}
