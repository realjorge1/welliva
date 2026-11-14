/**
 * services/training/pain.ts — "Did anything hurt?", and what the plan does about it.
 *
 * One optional tap on the session summary: No / Sore muscles / Sharp or joint
 * pain, and for pain, where. It changes two things and nothing else:
 *
 *   1. REST. An area that hurt is kept out of the plan for PAIN_REST_DAYS, by
 *      the same safety rules an injury entered in setup uses (./safety). The
 *      week's reasons then say "protects your knee", which is true. A fresh
 *      answer restarts the clock; changing the answer to "No" ends it.
 *   2. A NOTE. The same area hurting in PAIN_REPEAT_SESSIONS separate sessions
 *      inside PAIN_REPEAT_DAYS is worth getting checked (services/checks).
 *
 * Sore muscles change nothing: soreness a day or two after training is normal,
 * and the summary says so.
 *
 * Pure. The answers live in the fitness profile (`painHistory`); the plan
 * reads them through `withRestingAreas` in contexts/domain/useWorkoutState.
 */

import type { PainMemory } from "../../fitness/types";
import type { UserBio } from "../../models/user";
import { addDays, daysBetween } from "../cycle/dates";

/**
 * The areas offered, with the word handed to the safety rules. Each word is a
 * keyword ./safety's INJURY_RULES already knows, so a rested knee is excluded
 * exactly the way a knee injury from setup is.
 */
export const PAIN_AREAS = [
  { id: "neck", label: "Neck", injury: "neck" },
  { id: "shoulder", label: "Shoulder", injury: "shoulder" },
  { id: "elbow", label: "Elbow", injury: "elbow" },
  { id: "wrist", label: "Wrist", injury: "wrist" },
  { id: "back", label: "Lower back", injury: "lower back" },
  { id: "hip", label: "Hip", injury: "hip" },
  { id: "knee", label: "Knee", injury: "knee" },
  { id: "ankle", label: "Ankle", injury: "ankle" },
] as const;

export type PainAreaId = (typeof PAIN_AREAS)[number]["id"];

const AREA_BY_ID = new Map<string, (typeof PAIN_AREAS)[number]>(PAIN_AREAS.map((a) => [a.id, a]));

/** About two weeks: long enough for a minor strain to settle, short enough not to stall the plan. */
export const PAIN_REST_DAYS = 14;
/** The same spot hurting in this many separate sessions… */
export const PAIN_REPEAT_SESSIONS = 3;
/** …inside this many days is worth getting checked. */
export const PAIN_REPEAT_DAYS = 14;
/** Answers kept: comfortably more than any window above reads. */
export const PAIN_MEMORY_LIMIT = 60;

export function isPainArea(id: string): id is PainAreaId {
  return AREA_BY_ID.has(id);
}

export function painAreaLabel(id: string): string {
  return AREA_BY_ID.get(id)?.label ?? id;
}

/** Add or replace the answer for one session run, newest last, bounded. */
export function withPainAnswer(history: readonly PainMemory[] | undefined, answer: PainMemory): PainMemory[] {
  const kept = (history ?? []).filter((p) => p.runId !== answer.runId);
  const areas = answer.answer === "pain" ? (answer.areas ?? []).filter(isPainArea) : undefined;
  const clean: PainMemory = { ...answer, ...(areas ? { areas } : {}) };
  if (answer.answer !== "pain") delete clean.areas;
  return [...kept, clean].slice(-PAIN_MEMORY_LIMIT);
}

/** The answer already given for a run, if any. */
export function answerFor(history: readonly PainMemory[] | undefined, runId: string): PainMemory | null {
  return (history ?? []).find((p) => p.runId === runId) ?? null;
}

/** Areas that hurt inside the rest window, with the last day each did. */
export function restingAreas(
  history: readonly PainMemory[] | undefined,
  today: string,
): { id: PainAreaId; lastDate: string; until: string }[] {
  const from = addDays(today, -(PAIN_REST_DAYS - 1));
  const last = new Map<PainAreaId, string>();
  for (const p of history ?? []) {
    if (p.answer !== "pain" || p.date < from || p.date > today) continue;
    for (const a of p.areas ?? []) {
      if (!isPainArea(a)) continue;
      const seen = last.get(a);
      if (!seen || p.date > seen) last.set(a, p.date);
    }
  }
  return PAIN_AREAS.filter((a) => last.has(a.id)).map((a) => {
    const lastDate = last.get(a.id) as string;
    return { id: a.id, lastDate, until: addDays(lastDate, PAIN_REST_DAYS) };
  });
}

/**
 * The bio the plan is built from: the person's own, plus the resting areas as
 * injuries. An area their profile already names isn't added twice. Returns the
 * same object when nothing is resting, so a plan's fingerprint doesn't move.
 */
export function withRestingAreas(bio: UserBio, history: readonly PainMemory[] | undefined, today: string): UserBio {
  const resting = restingAreas(history, today);
  if (!resting.length) return bio;
  const own = (bio.injuries ?? []).map((s) => s.toLowerCase());
  const extra = resting
    .map((r) => AREA_BY_ID.get(r.id)!.injury)
    .filter((word) => !own.some((o) => o.includes(word)));
  if (!extra.length) return bio;
  return { ...bio, injuries: [...(bio.injuries ?? []), ...extra] };
}

/**
 * Areas that hurt in PAIN_REPEAT_SESSIONS or more separate sessions inside the
 * last PAIN_REPEAT_DAYS. Sessions are counted by run, so two answers about one
 * session (a changed mind) never count twice.
 */
export function recurringPain(
  history: readonly PainMemory[] | undefined,
  today: string,
): { id: PainAreaId; dates: string[] }[] {
  const from = addDays(today, -(PAIN_REPEAT_DAYS - 1));
  const runs = new Map<PainAreaId, Map<string, string>>();
  for (const p of history ?? []) {
    if (p.answer !== "pain" || p.date < from || p.date > today) continue;
    for (const a of p.areas ?? []) {
      if (!isPainArea(a)) continue;
      if (!runs.has(a)) runs.set(a, new Map());
      runs.get(a)!.set(p.runId, p.date);
    }
  }
  const out: { id: PainAreaId; dates: string[] }[] = [];
  for (const a of PAIN_AREAS) {
    const r = runs.get(a.id);
    if (r && r.size >= PAIN_REPEAT_SESSIONS) out.push({ id: a.id, dates: [...r.values()].sort() });
  }
  return out;
}

/** "your knee", "your lower back and your knee". */
export function areaWords(ids: readonly string[]): string {
  const words = ids.map((id) => `your ${painAreaLabel(id).toLowerCase()}`);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The line the summary shows once an answer is saved. */
export function painReceipt(answer: PainMemory, today: string): string {
  if (answer.answer === "none") return "Good. Nothing changes.";
  if (answer.answer === "sore")
    return "Sore muscles a day or two after training are normal. Nothing changes in your plan.";
  const ids = answer.areas ?? [];
  if (!ids.length) return "Noted.";
  const days = daysBetween(today, addDays(answer.date, PAIN_REST_DAYS));
  const span = days >= 13 ? "the next two weeks" : days > 1 ? `the next ${days} days` : "a little while";
  return `Your plan will go easy on ${areaWords(ids)} for ${span}. If it's still hurting, or it's swollen, get it checked.`;
}
