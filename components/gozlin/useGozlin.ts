/**
 * useGozlin — the bridge hook.
 *
 * Connects Welliva's AppContext state to the Gozlin engine package and the
 * on-device memory store, exposing exactly what the coach screen needs:
 * the Twin, the day's briefing, suggestion chips, the conversation, and a
 * `send()` that runs the (offline-first) chat engine and persists memory.
 *
 * All coaching logic lives in services/gozlin/*; this hook is wiring + state.
 */

import { useApp } from "@/contexts/AppContext";
import { currentWeekStart } from "@/services/OfflineStorage";
import {
  addCheckin,
  addEpisode,
  buildBriefing,
  clearGozlinMemory,
  loadCheckins,
  loadConversation,
  loadIdentity,
  rememberMotivation,
  respond,
  saveConversation,
  userMsg,
  type GozlinBriefing,
  type GozlinChatContext,
  type GozlinCheckin,
  type GozlinIdentityMemory,
  type GozlinMessage,
  type GozlinSuggestion,
  type GozlinTwin,
} from "@/services/gozlin";
import { makeWeighIn } from "@/services/BodyLogService";
import { RemoteGozlinProvider } from "@/services/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckinPayload } from "./CheckinModal";
import { useGozlinSnapshot } from "./useGozlinSnapshot";

const SUGGESTIONS: GozlinSuggestion[] = [
  { label: "Today", prompt: "What should I focus on today?", icon: "today-outline" },
  { label: "Tune my training", prompt: "Adapt my workout to how I've been performing", icon: "barbell-outline" },
  { label: "Optimize nutrition", prompt: "Optimize my nutrition based on what I've been eating", icon: "nutrition-outline" },
  { label: "My forecast", prompt: "What am I on track to achieve?", icon: "trending-up-outline" },
  { label: "This week", prompt: "Give me my weekly review", icon: "calendar-outline" },
  { label: "My habits", prompt: "What habits have you noticed about me?", icon: "sparkles-outline" },
  { label: "Why am I stuck?", prompt: "Investigate why my progress isn't moving", icon: "search-outline" },
  { label: "Should I train?", prompt: "Should I train today?", icon: "barbell-outline" },
];

export interface UseGozlin {
  twin: GozlinTwin;
  briefing: GozlinBriefing;
  suggestions: GozlinSuggestion[];
  messages: GozlinMessage[];
  isThinking: boolean;
  motivation?: string;
  send: (text: string) => Promise<void>;
  resetConversation: () => Promise<void>;
  forgetMe: () => Promise<void>;
  /** Record a weigh-in (+ optional waist), then surface a fresh forecast. */
  logWeighIn: (weightKg: number, waistCm?: number) => Promise<void>;
  /** Set the goal weight the forecast aims at. */
  setGoalWeight: (kg: number) => Promise<void>;
  /** Today's self-reported check-in, or null (prefills the check-in sheet). */
  todayCheckin: GozlinCheckin | null;
  /** Record/replace today's sleep / mood / stress check-in. */
  logCheckin: (data: CheckinPayload) => Promise<void>;
}

export function useGozlin(): UseGozlin {
  const app = useApp();
  const [identity, setIdentity] = useState<GozlinIdentityMemory>({
    preferences: [],
    constraints: [],
    updatedAt: 0,
  });
  const [messages, setMessages] = useState<GozlinMessage[]>([]);
  const [checkins, setCheckins] = useState<GozlinCheckin[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const seededRef = useRef(false);

  // ── Snapshot → Twin (shared bridge — one source of truth) ──
  const { snapshot, twin } = useGozlinSnapshot();

  const briefing = useMemo(
    () =>
      buildBriefing({
        twin,
        insights: app.coachInsights,
        dietHistory: app.dietHistory,
        workoutLog: app.workoutLog,
        motivation: identity.motivation,
        journeyStartedAt: app.userGoals?.journeyStartedAt,
        weeklyWorkoutTarget: app.userGoals?.weeklyWorkoutsTarget ?? 3,
      }),
    [
      twin,
      app.coachInsights,
      app.dietHistory,
      app.workoutLog,
      app.userGoals,
      identity.motivation,
    ],
  );

  const chatContext = useMemo<GozlinChatContext>(
    () => ({
      twin,
      snapshot,
      insights: app.coachInsights,
      identity,
      checkins,
      weekStart: currentWeekStart(),
      weeklyWorkoutTarget: app.userGoals?.weeklyWorkoutsTarget ?? 3,
    }),
    [twin, snapshot, app.coachInsights, identity, checkins, app.userGoals],
  );

  // ── Load memory + conversation + check-ins once ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const [id, convo, chk] = await Promise.all([
        loadIdentity(),
        loadConversation(),
        loadCheckins(),
      ]);
      if (!alive) return;
      setIdentity(id);
      setMessages(convo);
      setCheckins(chk);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Seed the thread with the day's briefing opener (once, when empty) ──
  useEffect(() => {
    if (seededRef.current) return;
    if (messages.length > 0) {
      seededRef.current = true;
      return;
    }
    // Wait until identity load has had a chance (updatedAt set or messages loaded).
    seededRef.current = true;
    const opener: GozlinMessage = {
      id: `gz_brief_${Date.now()}`,
      role: "coach",
      content: `${briefing.greeting} ${briefing.headline}`,
      tone: briefing.tone,
      structured: briefing,
      createdAt: Date.now(),
    };
    setMessages([opener]);
  }, [messages.length, briefing]);

  // ── Send ──
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;
      const outgoing = userMsg(trimmed);
      setMessages((prev) => [...prev, outgoing]);
      setIsThinking(true);
      try {
        // Structured coaching stays deterministic; open-ended chat is answered
        // by the backend (Claude Haiku) when configured, falling back to the
        // deterministic reply on any error.
        const result = await respond(trimmed, chatContext, RemoteGozlinProvider);
        setMessages((prev) => {
          const next = [...prev, result.message];
          saveConversation(next);
          return next;
        });
        // Apply memory side-effects the pure engine surfaced.
        if (result.effects?.rememberMotivation) {
          await rememberMotivation(result.effects.rememberMotivation);
          setIdentity((prev) => ({
            ...prev,
            motivation: result.effects!.rememberMotivation,
            updatedAt: Date.now(),
          }));
        }
        if (result.effects?.addEpisode) await addEpisode(result.effects.addEpisode);
      } finally {
        setIsThinking(false);
      }
    },
    [chatContext, isThinking],
  );

  const resetConversation = useCallback(async () => {
    setMessages([]);
    seededRef.current = false;
    await saveConversation([]);
  }, []);

  const forgetMe = useCallback(async () => {
    await clearGozlinMemory();
    setIdentity({ preferences: [], constraints: [], updatedAt: 0 });
    setMessages([]);
    seededRef.current = false;
  }, []);

  const logWeighIn = useCallback(
    async (weightKg: number, waistCm?: number) => {
      await app.logBodyMeasurement(makeWeighIn(weightKg, { waistCm }));
    },
    [app],
  );

  const setGoalWeight = useCallback(
    async (kg: number) => {
      await app.setTargetWeight(kg);
    },
    [app],
  );

  const todayCheckin = useMemo(
    () => checkins.find((c) => c.date === app.currentDate) ?? null,
    [checkins, app.currentDate],
  );

  const logCheckin = useCallback(
    async (data: CheckinPayload) => {
      const checkin: GozlinCheckin = {
        date: app.currentDate,
        ...(data.mood != null ? { mood: data.mood } : {}),
        ...(data.energy != null ? { energy: data.energy } : {}),
        ...(data.stress != null ? { stress: data.stress } : {}),
        ...(data.sleepHours != null ? { sleepHours: data.sleepHours } : {}),
        createdAt: Date.now(),
      };
      const next = await addCheckin(checkin);
      setCheckins(next);
    },
    [app.currentDate],
  );

  return {
    twin,
    briefing,
    suggestions: SUGGESTIONS,
    messages,
    isThinking,
    motivation: identity.motivation,
    send,
    resetConversation,
    forgetMe,
    logWeighIn,
    setGoalWeight,
    todayCheckin,
    logCheckin,
  };
}
