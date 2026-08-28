/**
 * GOZLIN — Memory Store (Phase 1 §8, Phase 2 §11).
 *
 * The 4-tier, on-device memory that makes Gozlin a *persistent* coach rather than
 * a stateless bot: Identity, Episodic, Behavioral, Conversational. All local
 * (AsyncStorage via OfflineStorage helpers) — nothing leaves the device. Mirrors
 * Welliva's storage conventions (JSON, namespaced keys, graceful fallback).
 *
 * Memory rules enforced here: only what the user states or the app records is
 * stored; episodic memory rolls (capped + age-bounded); conversation is capped.
 */

import { parseLocalDate, readJSON, writeJSON, remove } from "../OfflineStorage";
import type {
  GozlinCheckin,
  GozlinEpisode,
  GozlinIdentityMemory,
  GozlinMemorySnapshot,
  GozlinMessage,
  HabitPattern,
} from "./gozlin.types";

const G_KEYS = {
  IDENTITY: "@gozlin_identity",
  EPISODIC: "@gozlin_episodic",
  BEHAVIORAL: "@gozlin_behavioral",
  CONVERSATION: "@gozlin_conversation",
  ARCHIVE: "@gozlin_conversation_archive",
  CHECKINS: "@gozlin_checkins",
  LAST_BRIEFING: "@gozlin_last_briefing",
  LAST_WEEKLY_REVIEW: "@gozlin_last_weekly_review",
  FORECAST_CACHE: "@gozlin_forecast_cache",
} as const;

const EPISODE_CAP = 100;
const EPISODE_MAX_AGE_DAYS = 90;
const CONVERSATION_CAP = 60;
/** How many past conversations the history list keeps. */
const ARCHIVE_CAP = 40;
/** Below this a thread is an opener nobody replied to — not worth keeping. */
const ARCHIVE_MIN_MESSAGES = 2;
const CHECKIN_CAP = 120;
const CHECKIN_MAX_AGE_DAYS = 90;

const DEFAULT_IDENTITY: GozlinIdentityMemory = {
  preferences: [],
  constraints: [],
  updatedAt: 0,
};

// ── Identity tier ────────────────────────────────────────────────

export async function loadIdentity(): Promise<GozlinIdentityMemory> {
  return readJSON<GozlinIdentityMemory>(G_KEYS.IDENTITY, DEFAULT_IDENTITY);
}

export async function saveIdentity(
  patch: Partial<GozlinIdentityMemory>,
): Promise<GozlinIdentityMemory> {
  const current = await loadIdentity();
  const next: GozlinIdentityMemory = {
    ...current,
    ...patch,
    preferences: patch.preferences ?? current.preferences,
    constraints: patch.constraints ?? current.constraints,
    updatedAt: Date.now(),
  };
  await writeJSON(G_KEYS.IDENTITY, next);
  return next;
}

/** Record the user's stated "why" (motivation). */
export async function rememberMotivation(motivation: string): Promise<void> {
  await saveIdentity({ motivation: motivation.trim() });
}

/** Append a de-duplicated preference the user told Gozlin. */
export async function rememberPreference(pref: string): Promise<void> {
  const id = await loadIdentity();
  const p = pref.trim();
  if (!p || id.preferences.includes(p)) return;
  await saveIdentity({ preferences: [...id.preferences, p] });
}

// ── Episodic tier ────────────────────────────────────────────────

function pruneEpisodes(episodes: GozlinEpisode[]): GozlinEpisode[] {
  const cutoff = Date.now() - EPISODE_MAX_AGE_DAYS * 86400_000;
  const fresh = episodes.filter((e) => {
    const t = new Date(`${e.date}T00:00:00`).getTime();
    return Number.isNaN(t) || t >= cutoff;
  });
  return fresh.slice(-EPISODE_CAP);
}

export async function loadEpisodes(): Promise<GozlinEpisode[]> {
  return readJSON<GozlinEpisode[]>(G_KEYS.EPISODIC, []);
}

/** Add an acknowledged event, de-duped by id. Keeps the list pruned. */
export async function addEpisode(episode: GozlinEpisode): Promise<void> {
  const list = await loadEpisodes();
  if (list.some((e) => e.id === episode.id)) return;
  await writeJSON(G_KEYS.EPISODIC, pruneEpisodes([...list, episode]));
}

/** Forget one episodic milestone by id (Memory Center "forget"). Returns the kept list. */
export async function removeEpisode(id: string): Promise<GozlinEpisode[]> {
  const list = await loadEpisodes();
  const next = list.filter((e) => e.id !== id);
  if (next.length !== list.length) await writeJSON(G_KEYS.EPISODIC, next);
  return next;
}

// ── Behavioral tier (cached learned patterns) ────────────────────

export async function loadBehavioral(): Promise<HabitPattern[]> {
  return readJSON<HabitPattern[]>(G_KEYS.BEHAVIORAL, []);
}

export async function saveBehavioral(patterns: HabitPattern[]): Promise<void> {
  await writeJSON(G_KEYS.BEHAVIORAL, patterns);
}

// ── Check-in tier (self-reported sleep / mood / stress) ──────────
//
// The only source of the "life habits" the app can't measure on its own
// (Phase 7). Optional + on-device; every habit read degrades gracefully when
// there are none. One entry per calendar day — re-logging a day overwrites it.

function pruneCheckins(checkins: GozlinCheckin[]): GozlinCheckin[] {
  const cutoff = Date.now() - CHECKIN_MAX_AGE_DAYS * 86400_000;
  const fresh = checkins.filter((c) => {
    const t = parseLocalDate(c.date).getTime();
    return Number.isNaN(t) || t >= cutoff;
  });
  return fresh.sort((a, b) => a.date.localeCompare(b.date)).slice(-CHECKIN_CAP);
}

export async function loadCheckins(): Promise<GozlinCheckin[]> {
  return readJSON<GozlinCheckin[]>(G_KEYS.CHECKINS, []);
}

/** Today's check-in (by local date), or null. */
export async function getTodayCheckin(date: string): Promise<GozlinCheckin | null> {
  const list = await loadCheckins();
  return list.find((c) => c.date === date) ?? null;
}

/** Add or replace a day's check-in. Returns the pruned, ascending list. */
export async function addCheckin(checkin: GozlinCheckin): Promise<GozlinCheckin[]> {
  const list = await loadCheckins();
  const deduped = list.filter((c) => c.date !== checkin.date);
  const next = pruneCheckins([...deduped, checkin]);
  await writeJSON(G_KEYS.CHECKINS, next);
  return next;
}

// ── Conversational tier ──────────────────────────────────────────

export async function loadConversation(): Promise<GozlinMessage[]> {
  return readJSON<GozlinMessage[]>(G_KEYS.CONVERSATION, []);
}

/** Persist the rolling conversation, capped to the most recent turns. */
export async function saveConversation(messages: GozlinMessage[]): Promise<void> {
  await writeJSON(G_KEYS.CONVERSATION, messages.slice(-CONVERSATION_CAP));
}

// ── Conversation archive (chat history) ──────────────────────────
//
// "New conversation" used to DELETE the thread. That is a strange thing for a
// coach whose entire pitch is that it remembers you: the advice survived in the
// memory tiers, but the conversation people actually wanted to re-read was
// gone. Starting a new chat now files the old one here instead, and the coach
// screen offers it back as history.
//
// This is a convenience record, not a memory tier. Nothing reasons over it —
// the engines read Identity/Episodic/Behavioral — so capping it is free, and
// "Forget what you know" still takes it with everything else (it's in G_KEYS).

export interface ArchivedConversation {
  id: string;
  /** First user line, trimmed — what the row is titled with. */
  title: string;
  messages: GozlinMessage[];
  startedAt: number;
  endedAt: number;
}

export async function loadArchive(): Promise<ArchivedConversation[]> {
  return readJSON<ArchivedConversation[]>(G_KEYS.ARCHIVE, []);
}

/**
 * File a finished thread, newest first. Returns the updated list.
 *
 * A thread that never got past the day's briefing opener is dropped rather than
 * archived — a history full of "Good morning" entries nobody wrote is worse
 * than no history.
 */
export async function archiveConversation(
  messages: GozlinMessage[],
): Promise<ArchivedConversation[]> {
  const archive = await loadArchive();
  if (messages.length < ARCHIVE_MIN_MESSAGES || !messages.some((m) => m.role === "user")) {
    return archive;
  }

  const entry: ArchivedConversation = {
    id: `gzc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: conversationTitle(messages),
    messages: messages.slice(-CONVERSATION_CAP),
    startedAt: messages[0]?.createdAt ?? Date.now(),
    endedAt: messages[messages.length - 1]?.createdAt ?? Date.now(),
  };

  const next = [entry, ...archive].slice(0, ARCHIVE_CAP);
  await writeJSON(G_KEYS.ARCHIVE, next);
  return next;
}

export async function deleteArchivedConversation(
  id: string,
): Promise<ArchivedConversation[]> {
  const next = (await loadArchive()).filter((c) => c.id !== id);
  await writeJSON(G_KEYS.ARCHIVE, next);
  return next;
}

export async function clearArchive(): Promise<void> {
  await remove(G_KEYS.ARCHIVE);
}

/** The user's own first words — the only honest title for their conversation. */
function conversationTitle(messages: GozlinMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.trim();
  if (!first) return "Conversation";
  const oneLine = first.replace(/\s+/g, " ");
  return oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine;
}

// ── Meta gates ───────────────────────────────────────────────────

export interface LastBriefingMeta {
  date: string; // YYYY-MM-DD
  headlineKind: string;
}

export async function getLastBriefing(): Promise<LastBriefingMeta | null> {
  return readJSON<LastBriefingMeta | null>(G_KEYS.LAST_BRIEFING, null);
}

export async function setLastBriefing(meta: LastBriefingMeta): Promise<void> {
  await writeJSON(G_KEYS.LAST_BRIEFING, meta);
}

export async function getLastWeeklyReview(): Promise<string | null> {
  return readJSON<string | null>(G_KEYS.LAST_WEEKLY_REVIEW, null);
}

export async function setLastWeeklyReview(weekStart: string): Promise<void> {
  await writeJSON(G_KEYS.LAST_WEEKLY_REVIEW, weekStart);
}

// ── Aggregate + reset ────────────────────────────────────────────

export async function loadMemorySnapshot(): Promise<GozlinMemorySnapshot> {
  const [identity, episodic, behavioral] = await Promise.all([
    loadIdentity(),
    loadEpisodes(),
    loadBehavioral(),
  ]);
  return { identity, episodic, behavioral };
}

/** Wipe everything Gozlin remembers (user-facing "forget me"). */
export async function clearGozlinMemory(): Promise<void> {
  await Promise.all(Object.values(G_KEYS).map((k) => remove(k)));
}
