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
  saveConversation,
  saveIdentity,
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
import { coachTransport } from "@/services/api";
import { useBilling } from "@/contexts/BillingContext";
import {
  checkCoachQuota,
  spendCoachTurn,
  type MeteredState,
} from "@/services/billing";
import { runAgentTurn } from "@/services/gozlin/agent";
import type {
  GozlinToolActions,
  ToolConfirmRequest,
} from "@/services/gozlin/agent";
import {
  ensureFoodDictionaryLoaded,
  searchFoods,
} from "@/constants/FoodDictionary";
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

/** A write tool waiting on the user. Resolved by `respondToConfirm`. */
export interface PendingConfirm extends ToolConfirmRequest {
  id: string;
}

/**
 * The coach reply shown when the daily allowance is gone.
 *
 * Written in Gozlin's own voice rather than as a system error, because that's
 * what it is from the user's side — the coach saying "that's it for today". Tone
 * is `gentle`: they did nothing wrong by asking a fourth question.
 */
function limitReply(quota: MeteredState): GozlinMessage {
  const content = quota.isPro
    ? `We've covered a lot today — ${quota.limit} messages. Let's pick this up ` +
      `tomorrow; I'll still be tracking everything in the meantime.`
    : `That's my ${quota.limit} messages for today. Welliva Pro removes the ` +
      `daily limit and lets me remember our history, so the advice builds on ` +
      `itself instead of starting over. Either way I'll keep watching your logs ` +
      `— your plan, streaks and tracking don't change.`;
  return {
    id: `gz_limit_${Date.now()}`,
    role: "coach",
    content,
    tone: "gentle",
    createdAt: Date.now(),
  };
}

export interface UseGozlin {
  twin: GozlinTwin;
  briefing: GozlinBriefing;
  suggestions: GozlinSuggestion[];
  messages: GozlinMessage[];
  isThinking: boolean;
  /**
   * What the coach is doing right now ("checking your recovery…"), or null.
   * The agent loop can run several seconds; naming the work turns that latency
   * into a trust signal instead of dead air.
   */
  activity: string | null;
  /** A pending write-tool confirmation, or null. Render as a sheet. */
  pendingConfirm: PendingConfirm | null;
  /** Answer the pending confirmation. */
  respondToConfirm: (approved: boolean) => void;
  motivation?: string;
  /**
   * Today's AI-coaching allowance, or null while it's still being read.
   * `metered: false` means no cap applies in this build — render nothing.
   */
  quota: MeteredState | null;
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
  const { openPaywall } = useBilling();
  const [quota, setQuota] = useState<MeteredState | null>(null);
  const [identity, setIdentity] = useState<GozlinIdentityMemory>({
    preferences: [],
    constraints: [],
    updatedAt: 0,
  });
  const [messages, setMessages] = useState<GozlinMessage[]>([]);
  const [checkins, setCheckins] = useState<GozlinCheckin[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const seededRef = useRef(false);
  /** Resolver for the in-flight confirmation, so a tool can `await` the user. */
  const confirmResolverRef = useRef<((approved: boolean) => void) | null>(null);
  /** Cancels an in-flight turn when the screen unmounts. */
  const abortRef = useRef<AbortController | null>(null);

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
      conversation: messages,
      weekStart: currentWeekStart(),
      weeklyWorkoutTarget: app.userGoals?.weeklyWorkoutsTarget ?? 3,
    }),
    [twin, snapshot, app.coachInsights, identity, checkins, messages, app.userGoals],
  );

  // ── Confirmation gate for write tools ──
  //
  // A tool calls `confirm()` and awaits; we surface a sheet and park the
  // resolver until the user answers. No timeout: an unanswered prompt should
  // block the turn, not silently resolve one way or the other.
  const respondToConfirm = useCallback((approved: boolean) => {
    confirmResolverRef.current?.(approved);
    confirmResolverRef.current = null;
    setPendingConfirm(null);
  }, []);

  const toolActions = useMemo<GozlinToolActions>(
    () => ({
      confirm: (request) =>
        new Promise<boolean>((resolve) => {
          confirmResolverRef.current = resolve;
          setPendingConfirm({ ...request, id: `cf_${Date.now()}` });
        }),

      rememberFact: async (kind, value) => {
        if (kind === "motivation") {
          await rememberMotivation(value);
          setIdentity((prev) => ({ ...prev, motivation: value, updatedAt: Date.now() }));
          return;
        }
        const next = await loadIdentity();
        const list = kind === "preference" ? "preferences" : "constraints";
        const updated = {
          ...next,
          [list]: [...new Set([...(next[list] ?? []), value])],
          updatedAt: Date.now(),
        };
        await saveIdentity(updated);
        setIdentity(updated);
      },

      logFood: async (name, servings) => {
        await ensureFoodDictionaryLoaded();
        const match = searchFoods(name)[0];
        if (!match) return { ok: false as const, reason: `No "${name}" in the food catalog.` };
        // One call per serving keeps the logged macros exactly the catalog's —
        // the coach must never cite a figure we scaled ourselves.
        const rounds = Math.max(1, Math.min(10, Math.round(servings)));
        for (let i = 0; i < rounds; i++) {
          const ok = await app.addFoodAsSnack(match);
          if (!ok) return { ok: false as const, reason: "No meal plan for today to log against." };
        }
        return {
          ok: true as const,
          name: match.name,
          calories: match.calories * rounds,
          proteinG: match.protein * rounds,
        };
      },
    }),
    [app],
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

  // ── Read today's allowance once, so the composer can show what's left ──
  // Only meaningful when there's a backend to meter; without one nothing is
  // capped and `quota` stays null.
  useEffect(() => {
    if (!coachTransport) return;
    let alive = true;
    void checkCoachQuota().then((q) => {
      if (alive) setQuota(q);
    });
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
  //
  // The model decides which engines to call; the engines run here on-device and
  // answer. Every failure path — offline, refusal, timeout, an ungrounded
  // number — lands on the deterministic reply, so this can only be better than
  // the old rule-based path, never worse.
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      // ── The daily allowance ──
      //
      // Only turns that reach the BACKEND are metered, so this check is skipped
      // entirely when there's no transport — the on-device deterministic coach
      // is free and unlimited, and always will be.
      //
      // Checked before any work so the cap arrives as the coach explaining
      // itself, not as a failed send. The user's message is still appended: they
      // typed it, so it belongs in the thread above the answer about why there
      // isn't one.
      if (coachTransport) {
        const q = await checkCoachQuota();
        setQuota(q);
        if (q.metered && !q.allowed) {
          setMessages((prev) => {
            const next = [...prev, userMsg(trimmed), limitReply(q)];
            saveConversation(next);
            return next;
          });
          // A Pro user who hits the fair-use ceiling gets the explanation only —
          // never a paywall. They already paid; selling to them again is insulting.
          if (!q.isPro) openPaywall("coach-limit");
          return;
        }
      }

      const outgoing = userMsg(trimmed);
      // A placeholder the stream fills in place, so the reply appears token by
      // token instead of after several seconds of nothing.
      const placeholderId = `gz_stream_${Date.now()}`;
      let streamed = "";

      setMessages((prev) => [
        ...prev,
        outgoing,
        { id: placeholderId, role: "coach", content: "", createdAt: Date.now() },
      ]);
      setIsThinking(true);
      setActivity(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchPlaceholder = (content: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, content } : m)),
        );

      try {
        const result = await runAgentTurn(
          trimmed,
          { ...chatContext, actions: toolActions },
          {
            transport: coachTransport,
            signal: controller.signal,
            onTurnStart: () => {
              // A retry or a post-tool turn re-renders from scratch — never
              // concatenate two drafts of the same reply.
              streamed = "";
              patchPlaceholder("");
            },
            onDelta: (delta) => {
              streamed += delta;
              setActivity(null);
              patchPlaceholder(streamed);
            },
            onActivity: (label) => setActivity(label),
          },
        );

        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === placeholderId ? { ...result.message, id: placeholderId } : m,
          );
          saveConversation(next);
          return next;
        });

        // Charge the allowance only for a turn that actually used the model.
        // A clinical-safety reply or a deterministic fallback (offline, refusal,
        // ungrounded number) cost us nothing, so they must not cost the user one
        // of three — otherwise a flaky connection eats their whole day's quota.
        if (result.source === "agent") setQuota(await spendCoachTurn());

        // Memory side-effects surfaced by the deterministic path (the agent's
        // own writes go through toolActions).
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
        setActivity(null);
        abortRef.current = null;
        // Never leave a write tool awaiting a sheet that's no longer on screen.
        if (confirmResolverRef.current) respondToConfirm(false);
      }
    },
    [chatContext, isThinking, toolActions, respondToConfirm, openPaywall],
  );

  // Abort any in-flight turn when the screen goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

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
    activity,
    pendingConfirm,
    respondToConfirm,
    motivation: identity.motivation,
    quota,
    send,
    resetConversation,
    forgetMe,
    logWeighIn,
    setGoalWeight,
    todayCheckin,
    logCheckin,
  };
}
