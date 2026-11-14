/**
 * services/export/myData.ts — "Download my data": what goes in the document.
 *
 * Privacy law in the EU and UK gives people the right to a copy of their data,
 * in a form they can keep and read. Until 2026-11-14 only workouts (Fitness
 * settings, as JSON) and the cycle log could be exported, and everything else
 * meant emailing us. This builds one Word document with all of it, written for
 * a person rather than a machine: dates as people write them, one table per
 * kind of record, every field named.
 *
 * WHAT'S IN IT: profile, weigh-ins, daily food totals, every meal and food
 * logged, water, workouts (with how they felt and anything that hurt), habits,
 * mood check-ins, the cycle log (when tracking is on and the lock let them in),
 * and what Gozlin remembers, including conversations.
 *
 * A section with nothing in it says so in one line, rather than vanishing: a
 * missing heading reads as "not exported", an empty one as "nothing logged".
 *
 * Pure. services/export/gather reads the stores; components/privacy/
 * DownloadMyData asks for the cycle unlock, builds and saves.
 */

import { LEGAL_CONTACT_EMAIL } from "../../constants/legal";
import type { EffortMemory, PainMemory } from "../../fitness/types";
import type { DietHistoryEntry } from "../../models/diet";
import type { UserBio, UserGoals } from "../../models/user";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import { formatDay } from "../cycle/dates";
import { readEntryValence, valenceLabel } from "../gozlin/mind";
import { hasRecordedIntake } from "../nutrition/recordedIntake";
import { painAreaLabel } from "../training/pain";
import type { DocBlock } from "./docx";

export interface ExportMeal {
  date: string;
  slot: string | null;
  name: string;
  kcal: number | null;
  /** "plan": a planned meal ticked as eaten; "log": a food logged by hand, scan, photo or Gozlin. */
  source: "plan" | "log";
}

export interface ExportHabit {
  name: string;
  createdAt: string;
  done: readonly string[];
  /** The day it was stopped, for a habit no longer tracked. */
  retiredAt?: string;
}

export interface ExportMood {
  date: string;
  kind?: string;
  valence?: number;
  mood?: number;
  labels?: string[];
  associations?: string[];
  sleepHours?: number;
  note?: string;
  createdAt: number;
}

export interface ExportMessage {
  role: string;
  content: string;
  createdAt: number;
}

export type ExportCycle =
  | { status: "off" }
  | { status: "locked" }
  | { status: "included"; csv: string };

export interface MyDataInput {
  exportedAt: Date;
  name?: string | null;
  email?: string | null;
  bio: UserBio | null;
  goals: UserGoals | null;
  bodyLogs: readonly BodyLogEntry[];
  dietHistory: readonly DietHistoryEntry[];
  meals: readonly ExportMeal[];
  water: readonly { date: string; ml: number; goalMl?: number }[];
  workouts: readonly WorkoutLogEntry[];
  effort: readonly EffortMemory[];
  pain: readonly PainMemory[];
  habits: readonly ExportHabit[];
  moods: readonly ExportMood[];
  cycle: ExportCycle;
  coach: {
    motivation?: string;
    preferences: readonly string[];
    constraints: readonly string[];
    episodes: readonly { date: string; summary: string }[];
    conversations: readonly { startedAt: number; messages: readonly ExportMessage[] }[];
  };
}

/* ─────────────────────────────── wording ─────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** "14 Nov 2026". Dates that aren't YYYY-MM-DD are shown as they are. */
export function day(iso: string | undefined | null): string {
  if (!iso) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatDay(iso, { year: true }) : iso;
}

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "lightly_active" → "Lightly active". */
export function words(token: string | undefined | null): string {
  if (!token) return "";
  const s = String(token).replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const num = (n: number | undefined | null, digits = 0): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits).replace(/\.0+$/, "") : "";

const list = (xs: readonly string[] | undefined | null): string => (xs && xs.length ? xs.join(", ") : "");

const EFFORT_WORDS: Record<string, string> = { easy: "Easy", right: "About right", hard: "Hard" };
const PAIN_WORDS: Record<string, string> = { none: "Nothing hurt", sore: "Sore muscles", pain: "Sharp or joint pain" };

/* ─────────────────────────────── csv ─────────────────────────────── */

/** RFC 4180-style parse, enough for the cycle export's own CSV. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ─────────────────────────────── sections ─────────────────────────────── */

function section(out: DocBlock[], title: string, body: DocBlock[], empty: string): void {
  out.push({ kind: "heading", text: title });
  if (body.length) out.push(...body);
  else out.push({ kind: "paragraph", text: empty });
}

function profileRows(input: MyDataInput): string[][] {
  const { bio, goals } = input;
  const rows: [string, string][] = [];
  const add = (label: string, value: string) => {
    if (value) rows.push([label, value]);
  };
  add("Name", input.name ?? "");
  add("Email", input.email ?? "");
  if (bio) {
    add("Age", num(bio.age));
    add("Sex", words(bio.sex));
    add("Height", bio.heightCm ? `${num(bio.heightCm)} cm` : "");
    add("Weight when you set up", bio.weightKg ? `${num(bio.weightKg, 1)} kg` : "");
    add("Daily activity", words(bio.activityLevel));
    add("Training experience", words(bio.exerciseLevel));
    add("Goals", list((bio.goals?.length ? bio.goals : [bio.primaryGoal]).map(words)));
    add("Eating style", words(bio.dietaryRestriction));
    add("Cuisine", words(bio.cuisinePreference));
    add("Region", bio.region ?? "");
    add("Meals a day", num(bio.mealsPerDay));
    add("Allergies", list(bio.allergies));
    add("Foods you don't like", list(bio.foodDislikes));
    add("Medical conditions", list(bio.medicalConditions?.map(words)));
    add("Pregnancy trimester", bio.pregnancyTrimester ? String(bio.pregnancyTrimester) : "");
    add("Injuries", list(bio.injuries));
    add("Medications", list(bio.medications));
    add("Kinds of medication", list(bio.medicationCategories?.map(words)));
    add("Equipment", list(bio.equipment?.map(words)));
    add("Workout days a week", num(bio.workoutDaysPerWeek));
  }
  if (goals) {
    add("Goal weight", goals.targetWeightKg ? `${num(goals.targetWeightKg, 1)} kg` : "");
    add("Daily calorie target", num(goals.dailyCaloriesTarget));
    add("Daily water goal", goals.dailyWaterMl ? `${num(goals.dailyWaterMl)} ml` : "");
    add("Workouts a week", num(goals.weeklyWorkoutsTarget));
    add("Started on", day(goals.journeyStartedAt));
  }
  return rows;
}

const byDate = <T extends { date: string }>(xs: readonly T[]) => [...xs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/** The whole document, as blocks for services/export/docx. */
export function buildMyDataBlocks(input: MyDataInput): DocBlock[] {
  const out: DocBlock[] = [];
  const when = input.exportedAt;
  out.push({ kind: "title", text: "Your welliva data" });
  out.push({
    kind: "paragraph",
    text:
      `Downloaded on ${day(localDate(when.getTime()))} at ${clock(when.getTime())}. ` +
      "This is a copy of everything you've logged in welliva and what the app keeps about you. " +
      "It holds health information, so keep it somewhere private.",
  });
  out.push({
    kind: "note",
    text:
      "Inside: your profile, weight, food, water, workouts, habits, mood check-ins, your cycle log " +
      "(if you track one) and what Gozlin remembers. Weights are in kilograms, water in millilitres.",
  });

  // Profile
  const prof = profileRows(input);
  section(out, "Your profile", prof.length ? [{ kind: "table", header: ["", "What you told welliva"], rows: prof }] : [], "No profile saved.");

  // Weight
  const weights = byDate(input.bodyLogs);
  section(
    out,
    "Weight and measurements",
    weights.length
      ? [
          {
            kind: "table",
            header: ["Date", "Weight (kg)", "Waist (cm)", "Note"],
            rows: weights.map((w) => [day(w.date), num(w.weightKg, 1), num(w.waistCm, 1), w.notes ?? ""]),
          },
        ]
      : [],
    "No weigh-ins logged.",
  );

  // Food
  const days = byDate(input.dietHistory.filter(hasRecordedIntake));
  const meals = byDate(input.meals);
  const food: DocBlock[] = [];
  if (days.length) {
    food.push({ kind: "heading", level: 2, text: "Each day's totals" });
    food.push({
      kind: "table",
      header: ["Date", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
      rows: days.map((d) => [
        day(d.date),
        num(d.consumedCalories),
        num(d.consumedProteinG),
        num(d.consumedCarbsG),
        num(d.consumedFatG),
      ]),
    });
  }
  if (meals.length) {
    food.push({ kind: "heading", level: 2, text: "Everything you logged" });
    food.push({
      kind: "table",
      header: ["Date", "Meal", "What", "Calories", "How"],
      rows: meals.map((m) => [
        day(m.date),
        words(m.slot ?? "") || "Other",
        m.name,
        num(m.kcal),
        m.source === "plan" ? "Ticked from your plan" : "Logged",
      ]),
    });
  }
  section(out, "Food", food, "No food logged.");

  // Water
  const water = byDate(input.water.filter((w) => w.ml > 0));
  section(
    out,
    "Water",
    water.length
      ? [
          {
            kind: "table",
            header: ["Date", "Water (ml)", "Goal (ml)"],
            rows: water.map((w) => [day(w.date), num(w.ml), num(w.goalMl)]),
          },
        ]
      : [],
    "No water logged before today.",
  );

  // Workouts
  const workouts = byDate(input.workouts);
  const felt = new Map<string, string>();
  for (const e of input.effort) felt.set(`${e.date}|${e.workoutId}`, EFFORT_WORDS[e.effort] ?? words(e.effort));
  const train: DocBlock[] = [];
  if (workouts.length) {
    train.push({
      kind: "table",
      header: ["Date", "Session", "Minutes", "Done", "How it felt"],
      rows: workouts.map((w) => [
        day(w.date),
        w.sessionLabel,
        num(w.durationMinutes),
        `${num(w.completionPercent)}%`,
        felt.get(`${w.date}|${w.sessionId}`) ?? "",
      ]),
    });
  }
  const pain = byDate(input.pain);
  if (pain.length) {
    train.push({ kind: "heading", level: 2, text: "Did anything hurt?" });
    train.push({
      kind: "table",
      header: ["Date", "Answer", "Where"],
      rows: pain.map((p) => [day(p.date), PAIN_WORDS[p.answer] ?? words(p.answer), list(p.areas?.map(painAreaLabel))]),
    });
  }
  section(out, "Workouts", train, "No workouts logged.");

  // Habits
  const habits = [...input.habits].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  section(
    out,
    "Habits",
    habits.length
      ? [
          {
            kind: "table",
            header: ["Habit", "Started", "Times done", "Days done"],
            rows: habits.map((h) => [
              h.retiredAt ? `${h.name} (stopped ${day(h.retiredAt)})` : h.name,
              day(h.createdAt),
              String(h.done.length),
              [...h.done].sort().map(day).join(", "),
            ]),
          },
        ]
      : [],
    "No habits tracked.",
  );

  // Mood
  const moods = [...input.moods].sort((a, b) => a.createdAt - b.createdAt);
  section(
    out,
    "Mood check-ins",
    moods.length
      ? [
          {
            kind: "table",
            header: ["Date", "Time", "Feeling", "Words", "About", "Sleep (h)", "Note"],
            rows: moods.map((m) => {
              const v = readEntryValence(m);
              return [
                day(m.date),
                Number.isFinite(m.createdAt) ? clock(m.createdAt) : "",
                v === null ? "" : valenceLabel(v),
                list(m.labels),
                list(m.associations?.map(words)),
                num(m.sleepHours, 1),
                m.note ?? "",
              ];
            }),
          },
        ]
      : [],
    "No check-ins logged.",
  );

  // Cycle
  out.push({ kind: "heading", text: "Cycle log" });
  if (input.cycle.status === "off") {
    out.push({ kind: "paragraph", text: "Cycle tracking is off, so there's nothing to include." });
  } else if (input.cycle.status === "locked") {
    out.push({
      kind: "paragraph",
      text: "Your cycle log is locked, so it isn't in this copy. Download again and unlock when your phone asks to include it.",
    });
  } else {
    const [header, ...rows] = parseCsv(input.cycle.csv);
    if (header && rows.length) {
      out.push({
        kind: "table",
        header: header.map(words),
        rows: rows.map((r) => r.map((c, i) => (header[i] === "date" || header[i] === "end" ? day(c) : c))),
      });
    } else {
      out.push({ kind: "paragraph", text: "Nothing logged yet." });
    }
  }

  // Gozlin
  const coach: DocBlock[] = [];
  const told: string[][] = [];
  if (input.coach.motivation) told.push(["Why you're here", input.coach.motivation]);
  for (const p of input.coach.preferences) told.push(["Something you prefer", p]);
  for (const c of input.coach.constraints) told.push(["Something to work around", c]);
  if (told.length) {
    coach.push({ kind: "heading", level: 2, text: "What you told Gozlin" });
    coach.push({ kind: "table", header: ["", ""], rows: told });
  }
  const episodes = byDate(input.coach.episodes);
  if (episodes.length) {
    coach.push({ kind: "heading", level: 2, text: "Moments Gozlin remembers" });
    coach.push({ kind: "table", header: ["Date", "What"], rows: episodes.map((e) => [day(e.date), e.summary]) });
  }
  const talks = [...input.coach.conversations]
    .filter((c) => c.messages.some((m) => m.content.trim()))
    .sort((a, b) => a.startedAt - b.startedAt);
  if (talks.length) {
    coach.push({ kind: "heading", level: 2, text: "Conversations" });
    for (const t of talks) {
      coach.push({
        kind: "paragraph",
        text: `${day(localDate(t.startedAt))}, ${clock(t.startedAt)}`,
      });
      coach.push({
        kind: "table",
        header: ["Time", "Who", "Message"],
        rows: t.messages
          .filter((m) => m.content.trim())
          .map((m) => [clock(m.createdAt), m.role === "user" ? "You" : "Gozlin", m.content.trim()]),
      });
    }
  }
  section(out, "Gozlin", coach, "Gozlin doesn't remember anything yet.");

  out.push({
    kind: "note",
    text: `Questions about your data, or want something corrected or deleted? Write to ${LEGAL_CONTACT_EMAIL}.`,
  });
  return out;
}
