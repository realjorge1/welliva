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
  archiveConversation,
  buildBriefing,
  clearGozlinMemory,
  deleteArchivedConversation,
  loadArchive,
  loadCheckins,
  loadConversation,
  loadIdentity,
  rememberMotivation,
  saveConversation,
  saveIdentity,
  userMsg,
  type ArchivedConversation,
  type GozlinBriefing,
  type GozlinChatContext,
  type GozlinCheckin,
  type GozlinIdentityMemory,
  type GozlinMessage,
  type GozlinSuggestion,
  type GozlinTwin,
} from "@/services/gozlin";
import { buildHabitTrackerBrief } from "@/services/gozlin";
import { saveRetiredHabits } from "@/services/HabitService";
import { makeWeighIn } from "@/services/BodyLogService";
import { coachTransport } from "@/services/api";
import { useBilling } from "@/contexts/BillingContext";
import { useHabits } from "@/contexts/HabitsContext";
import {
  checkCoachQuota,
  checkDeepDive,
  spendCoachTurn,
  spendDeepDive,
  type MeteredState,
} from "@/services/billing";
import { runAgentTurn, runDeepDive } from "@/services/gozlin/agent";
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

/**
 * THE PROMPT POOL — twenty-six, of which four are on screen at a time.
 *
 * It used to be eight, all of them visible, every day, forever. That is a
 * menu, and a menu stops being read: by the third session the row was
 * furniture and the chips were decoration that cost a scroll. The bar now
 * deals four from this pool and swaps them each time it stirs (see
 * ./GozlinSuggestionBar), so the row is a different offer every few seconds
 * and there is a reason to look at it again.
 *
 * ORDER MATTERS AT THE FRONT ONLY. The first four are the opening hand — the
 * questions worth putting in front of someone who has never talked to a coach
 * before, in the order they would ask them. Everything after is dealt at
 * random and can be reordered freely.
 *
 * EVERY PROMPT MUST BE ANSWERABLE FROM THE USER'S OWN DATA. That is what makes
 * a chip worth tapping rather than a search box with extra steps: each one
 * lands on a tool the coach can actually run against their logs (see
 * services/gozlin/agent/tools.ts). A prompt that can only be answered in
 * generalities belongs in a deep dive, not on this row.
 *
 * LABELS ARE KEYS. The bar keys chips by label, so two prompts may never share
 * one — and a label is at most three words, because a chip that wraps or
 * truncates reads as broken.
 */
const SUGGESTIONS: GozlinSuggestion[] = [
  // ── The opening hand ──
  { label: "Today", prompt: "What should I focus on today?", icon: "today-outline" },
  { label: "Should I train?", prompt: "Should I train today?", icon: "barbell-outline" },
  { label: "This week", prompt: "Give me my weekly review", icon: "calendar-outline" },
  { label: "Why am I stuck?", prompt: "Investigate why my progress isn't moving", icon: "search-outline" },

  // ── Training ──
  { label: "Tune my training", prompt: "Adapt my workout to how I've been performing", icon: "options-outline" },
  { label: "Short on time", prompt: "I've only got 20 minutes to train today — what should I do?", icon: "timer-outline" },
  { label: "Still sore", prompt: "I'm sore from my last session. Train, or back off?", icon: "bandage-outline" },
  { label: "Too much?", prompt: "Am I doing too much? Check my training load.", icon: "pulse-outline" },
  { label: "Rest day", prompt: "What should a rest day look like for me?", icon: "bed-outline" },

  // ── Nutrition ──
  { label: "Optimize nutrition", prompt: "Optimize my nutrition based on what I've been eating", icon: "nutrition-outline" },
  { label: "Enough protein?", prompt: "Am I getting enough protein for my goal?", icon: "egg-outline" },
  { label: "What to eat", prompt: "What should I eat for my next meal?", icon: "fast-food-outline" },
  { label: "Eating out", prompt: "How do I stay on plan when I'm eating out tonight?", icon: "restaurant-outline" },
  { label: "Evening cravings", prompt: "I keep craving sugar in the evening — what does my data say?", icon: "ice-cream-outline" },
  { label: "Drinking enough?", prompt: "Am I drinking enough water for how I train?", icon: "water-outline" },

  // ── Progress ──
  { label: "My forecast", prompt: "What am I on track to achieve?", icon: "trending-up-outline" },
  { label: "Stalled", prompt: "My weight has stalled. What would you change first?", icon: "analytics-outline" },
  { label: "What changed", prompt: "What's changed about me in the last month?", icon: "swap-horizontal-outline" },
  { label: "Hit my target", prompt: "What's the fastest honest way to hit my target weight?", icon: "flag-outline" },
  { label: "Next four weeks", prompt: "Map out the next four weeks for me", icon: "map-outline" },

  // ── Patterns & recovery ──
  { label: "My habits", prompt: "What habits have you noticed about me?", icon: "sparkles-outline" },
  { label: "Am I recovered?", prompt: "How recovered am I right now, and what should I do about it?", icon: "battery-charging-outline" },
  { label: "Low energy", prompt: "I've been low on energy — what does my data say?", icon: "flash-outline" },
  { label: "Sleep & results", prompt: "How is my sleep affecting my results?", icon: "moon-outline" },
  { label: "Weekends", prompt: "My weekends undo my week. What would you change?", icon: "wine-outline" },
  { label: "My best week", prompt: "What does my best week actually look like?", icon: "ribbon-outline" },
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
  const content =
    quota.tier === "pro"
      ? `We've covered a lot today — ${quota.limit} messages. Let's pick this up ` +
        `tomorrow; I'll still be tracking everything in the meantime.`
      : quota.tier === "plus"
        ? `That's my ${quota.limit} messages for today — Plus is a generous ` +
          `allowance, and Pro lifts it entirely. Either way I'll keep watching ` +
          `your logs overnight.`
        : `That's my ${quota.limit} messages for today. A plan raises the daily ` +
          `limit and lets me remember our history, so the advice builds on ` +
          `itself instead of starting over. Either way I'll keep watching your ` +
          `logs — your plan, streaks and tracking don't change.`;
  return {
    id: `gz_limit_${Date.now()}`,
    role: "coach",
    content,
    tone: "gentle",
    createdAt: Date.now(),
  };
}

/** What came back from asking for the reading behind a reply. */
export interface DeepDiveOutcome {
  status: "ready" | "locked" | "error";
  /** The dive. Present when `ready`. */
  text?: string;
  /** The failure was a dead network, not a declined answer. */
  offline?: boolean;
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
  /**
   * Answer a coach message again, from the question that produced it.
   *
   * The reply is REPLACED, not appended: two answers to one question is a
   * transcript of the app failing, and the model would read the discarded one
   * back as context on the next turn. Offer this on the newest reply only —
   * re-running an older one would take everything after it with it.
   */
  regenerate: (messageId: string) => Promise<void>;
  /**
   * Rewrite one of the user's messages and re-answer from it. Everything after
   * it is dropped, because it answers a question that no longer exists.
   */
  editMessage: (messageId: string, text: string) => Promise<void>;
  /** Rate a reply. Passing the value it already has clears it. */
  rateMessage: (messageId: string, value: "up" | "down") => void;
  /**
   * The research behind a reply. Cached on the message, so re-opening one is
   * free — in allowance and in latency both.
   */
  deepDive: (
    messageId: string,
    onDelta?: (text: string) => void,
  ) => Promise<DeepDiveOutcome>;
  /** File the current thread and start an empty one. */
  resetConversation: () => Promise<void>;
  /**
   * Discard the current thread WITHOUT filing it. Nothing else Gozlin knows is
   * touched — see the implementation for why that separation is the point.
   */
  deleteConversation: () => Promise<void>;
  /** Past conversations, newest first. Filed by `resetConversation`. */
  archive: ArchivedConversation[];
  /** Reopen an archived thread as the live conversation. */
  openArchived: (id: string) => Promise<void>;
  deleteArchived: (id: string) => Promise<void>;
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
  const {
    views: habitViews,
    retired: retiredHabits,
    refreshRetired,
  } = useHabits();
  const { openUpgrade } = useBilling();
  const [quota, setQuota] = useState<MeteredState | null>(null);
  const [identity, setIdentity] = useState<GozlinIdentityMemory>({
    preferences: [],
    constraints: [],
    updatedAt: 0,
  });
  const [messages, setMessages] = useState<GozlinMessage[]>([]);
  /**
   * The stored conversation has been read. Until it has, an empty `messages` is
   * not evidence of an empty thread — it is the initial state, and treating it
   * as an answer is what the briefing seeder below used to do. See the note
   * there; it emptied the screen.
   */
  const [hydrated, setHydrated] = useState(false);
  const [archive, setArchive] = useState<ArchivedConversation[]>([]);
  const [checkins, setCheckins] = useState<GozlinCheckin[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const seededRef = useRef(false);
  /**
   * The live thread, readable without depending on it. Archiving happens from
   * a menu callback that must not be rebuilt on every streamed token.
   */
  const messagesRef = useRef<GozlinMessage[]>([]);
  messagesRef.current = messages;
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

  // The habit tracker, as facts Gozlin can cite. This is the half of the user's
  // routine that they DECLARED rather than the half we inferred, and it was the
  // one thing the coach could not see: it knew their adherence to a meal plan
  // and nothing about the vitamins they told the app they wanted to take.
  const habitBrief = useMemo(
    () =>
      buildHabitTrackerBrief({
        views: habitViews,
        retired: retiredHabits,
        today: app.currentDate,
      }),
    [habitViews, retiredHabits, app.currentDate],
  );

  const chatContext = useMemo<GozlinChatContext>(
    () => ({
      twin,
      snapshot,
      insights: app.coachInsights,
      identity,
      checkins,
      habits: habitBrief,
      conversation: messages,
      weekStart: currentWeekStart(),
      weeklyWorkoutTarget: app.userGoals?.weeklyWorkoutsTarget ?? 3,
    }),
    [twin, snapshot, app.coachInsights, identity, checkins, habitBrief, messages, app.userGoals],
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
  //
  // `hydrated` is set in a `finally`, and that is deliberate: it is the gate the
  // briefing seeder waits on, so a storage read that throws must still open it.
  // Otherwise one failed AsyncStorage call leaves the coach screen permanently
  // blank — no briefing, no messages, no way back — which is a far worse
  // outcome than starting the day on a fresh thread.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [id, convo, chk, past] = await Promise.all([
          loadIdentity(),
          loadConversation(),
          loadCheckins(),
          loadArchive(),
        ]);
        if (!alive) return;
        setIdentity(id);
        setMessages(convo);
        setCheckins(chk);
        setArchive(past);
      } finally {
        if (alive) setHydrated(true);
      }
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
  //
  // IT MUST WAIT FOR THE STORED THREAD, and this was a real screen-emptying bug
  // rather than a theoretical one.
  //
  // `messages` starts as `[]`, so on the very first render this effect used to
  // see an empty thread, latch `seededRef`, and seed the opener — all while
  // `loadConversation()` was still in flight. When that promise landed with an
  // empty array (a fresh install, the morning after "New conversation", or
  // anything after "Clear memory") it called `setMessages([])` and wiped the
  // opener it had raced. The latch was already set, so nothing ever re-seeded:
  // the coach screen sat there with no briefing, no card, and no messages at
  // all, permanently, until the user typed something.
  //
  // `hydrated` is the fix and it is the whole fix: nothing is seeded until the
  // stored conversation has actually arrived, so "is this thread empty?" is
  // asked once, of the real answer.
  useEffect(() => {
    if (!hydrated || seededRef.current) return;
    if (messages.length > 0) {
      seededRef.current = true;
      return;
    }
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
  }, [hydrated, messages.length, briefing]);

  // ── One turn ──
  //
  // The model decides which engines to call; the engines run here on-device and
  // answer. Every failure path — offline, refusal, timeout, an ungrounded
  // number — lands on the deterministic reply, so this can only be better than
  // the old rule-based path, never worse.
  //
  // `deliver` is the shared spine of THREE entry points — a new message, a
  // regeneration and an edit. They differ only in what the thread looks like
  // before the turn runs, so that is the only thing they pass: `thread` is what
  // stays on screen, `history` is what the model is shown.
  const deliver = useCallback(
    async (text: string, thread: GozlinMessage[], history: GozlinMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      // ── The daily allowance ──
      //
      // Only turns that reach the BACKEND are metered, so this check is skipped
      // entirely when there's no transport — the on-device deterministic coach
      // is free and unlimited, and always will be.
      //
      // Checked before any work so the cap arrives as the coach explaining
      // itself, not as a failed send. `thread` already ends with the message
      // being answered: they typed it, so it belongs above the answer about why
      // there isn't one.
      if (coachTransport) {
        const q = await checkCoachQuota();
        setQuota(q);
        if (q.metered && !q.allowed) {
          const next = [...thread, limitReply(q)];
          setMessages(next);
          saveConversation(next);
          // A Pro user who hits the fair-use ceiling gets the explanation only —
          // never a storefront. They already paid the top price; selling to them
          // again is insulting. A Plus user still sees the ask, because Pro
          // genuinely is what lifts this cap.
          if (q.tier !== "pro") openUpgrade("coach-limit");
          return;
        }
      }

      // A placeholder the stream fills in place, so the reply appears token by
      // token instead of after several seconds of nothing.
      const placeholderId = `gz_stream_${Date.now()}`;
      let streamed = "";

      setMessages([
        ...thread,
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
          // `history` is the thread WITHOUT the message being answered —
          // buildTurnMessages appends that itself, and passing it twice would
          // have the model reading the question as though it were asked twice.
          { ...chatContext, conversation: history, actions: toolActions },
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
    [chatContext, isThinking, toolActions, respondToConfirm, openUpgrade],
  );

  // ── Send ──
  //
  // The ordinary path: your message goes on the end of the thread, and the
  // whole thread before it is what the model sees.
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const history = messagesRef.current;
      await deliver(trimmed, [...history, userMsg(trimmed)], history);
    },
    [deliver],
  );

  /**
   * Answer the same question again.
   *
   * Everything from the old reply onward is dropped before the new turn runs.
   * The alternative — appending a second answer — leaves the thread holding two
   * contradictory replies to one question, and `toWireMessages` would feed the
   * rejected one back to the model as though it were something Gozlin stood by.
   */
  const regenerate = useCallback(
    async (messageId: string) => {
      const all = messagesRef.current;
      const idx = all.findIndex((m) => m.id === messageId);
      if (idx < 0 || all[idx].role !== "coach") return;

      let askedAt = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (all[i].role === "user") {
          askedAt = i;
          break;
        }
      }
      // The seeded briefing has no question behind it — there is nothing to
      // re-ask, and the day's opener is not a reply that can be improved.
      if (askedAt < 0) return;

      await deliver(all[askedAt].content, all.slice(0, idx), all.slice(0, askedAt));
    },
    [deliver],
  );

  /**
   * Rewrite a message you sent, and continue from the correction.
   *
   * The thread branches at the edit: the message keeps its id (so nothing
   * attached to it is orphaned) and everything after it goes, for the same
   * reason `regenerate` drops the reply it is replacing.
   */
  const editMessage = useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const all = messagesRef.current;
      const idx = all.findIndex((m) => m.id === messageId);
      if (idx < 0 || all[idx].role !== "user") return;

      const edited: GozlinMessage = {
        ...all[idx],
        content: trimmed,
        edited: true,
        createdAt: Date.now(),
      };
      await deliver(trimmed, [...all.slice(0, idx), edited], all.slice(0, idx));
    },
    [deliver],
  );

  /**
   * Rate a reply, or clear the rating by pressing the same thumb again.
   *
   * Local only. Nothing is uploaded, and nothing about it is shown back to the
   * model — a thumbs-down is a note the user leaves for themselves and for a
   * future version of this app, not a correction the coach reads and apologises
   * for. Persisted with the conversation so it survives a reload and travels
   * into the archive with the message it belongs to.
   */
  const rateMessage = useCallback((messageId: string, value: "up" | "down") => {
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === messageId
          ? { ...m, feedback: m.feedback === value ? undefined : value }
          : m,
      );
      saveConversation(next);
      return next;
    });
  }, []);

  /**
   * The reading behind a reply — see services/gozlin/agent/deepDive.ts.
   *
   * THE ORDER OF THE THREE CHECKS IS THE WHOLE FUNCTION:
   *
   *  1. A dive already written is returned as-is. Free, instant, offline, and
   *     it never touches the allowance — nobody is charged twice for re-reading
   *     something they already have.
   *  2. THEN the gate. Nothing is spent here; this only asks.
   *  3. THEN the model. And the allowance is spent only once text actually came
   *     back — a dive that died on a dead network cost the user nothing, so it
   *     must cost them nothing.
   */
  const deepDive = useCallback(
    async (
      messageId: string,
      onDelta?: (text: string) => void,
    ): Promise<DeepDiveOutcome> => {
      const all = messagesRef.current;
      const idx = all.findIndex((m) => m.id === messageId);
      if (idx < 0) return { status: "error" };

      const message = all[idx];
      if (message.deepDive) return { status: "ready", text: message.deepDive };

      const gate = await checkDeepDive();
      if (gate.metered && !gate.allowed) return { status: "locked" };

      let question = "";
      for (let i = idx - 1; i >= 0; i--) {
        if (all[i].role === "user") {
          question = all[i].content;
          break;
        }
      }
      // The day's briefing was not asked for, so give the dive the subject it
      // actually has rather than an empty question.
      if (!question) question = "Explain what you just told me.";

      const res = await runDeepDive(
        { question, answer: message.content, twin, context: { snapshot, identity } },
        { transport: coachTransport, onDelta },
      );
      if (!res.ok || !res.text) {
        return { status: "error", offline: res.reason === "offline" };
      }

      await spendDeepDive();
      const text = res.text;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === messageId ? { ...m, deepDive: text } : m));
        saveConversation(next);
        return next;
      });
      return { status: "ready", text };
    },
    [twin, snapshot, identity],
  );

  // Abort any in-flight turn when the screen goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Start a fresh thread — FILING the old one, not deleting it.
   *
   * `messagesRef` rather than `messages` so this doesn't have to be re-created
   * on every keystroke of every reply; the menu holds one reference for the
   * life of the screen and must still archive whatever is on screen when it's
   * finally tapped.
   */
  const resetConversation = useCallback(async () => {
    const finished = messagesRef.current;
    setMessages([]);
    seededRef.current = false;
    await saveConversation([]);
    setArchive(await archiveConversation(finished));
  }, []);

  /**
   * Throw the live thread away — the one thing "New conversation" deliberately
   * will not do.
   *
   * ── WHY BOTH EXIST ──────────────────────────────────────────────────────
   *
   * Filing and deleting are different intentions and the app was only offering
   * one of them. "New conversation" archives, because the usual reason to start
   * fresh is a change of subject and losing the last thread would be a surprise.
   * But people also say things to a health coach they simply do not want kept —
   * a weight, a bad week, something about their body — and until now the only
   * way to remove one exchange was "Clear memory", which throws out the coach's
   * entire understanding of them along with it. Making someone choose between
   * keeping a private conversation and keeping their coach is not a choice
   * anyone should be asked to make.
   *
   * SO THIS DELETES EXACTLY ONE THING: the messages on screen. It does not
   * touch the archive, the identity tier, episodes, behavioural patterns or
   * check-ins — deleting a conversation is not the same as being forgotten, and
   * conflating the two is how "delete" becomes a button nobody dares press.
   *
   * The seeder puts today's briefing back (`seededRef` is released), so what you
   * are left with is a clean thread rather than an empty screen.
   */
  const deleteConversation = useCallback(async () => {
    setMessages([]);
    seededRef.current = false;
    await saveConversation([]);
  }, []);

  /**
   * Reopen an archived thread as the live one. The conversation currently on
   * screen is filed first, so switching between threads never costs you the one
   * you were in — and the reopened thread leaves the archive, because two
   * copies of the same conversation in one list is a bug people report.
   */
  const openArchived = useCallback(async (id: string) => {
    const entry = (await loadArchive()).find((c) => c.id === id);
    if (!entry) return;

    await archiveConversation(messagesRef.current);
    const remaining = await deleteArchivedConversation(id);
    setArchive(remaining);

    seededRef.current = true; // it has content — don't seed a briefing over it
    setMessages(entry.messages);
    await saveConversation(entry.messages);
  }, []);

  const deleteArchived = useCallback(async (id: string) => {
    setArchive(await deleteArchivedConversation(id));
  }, []);

  /**
   * "Clear memory" — and it has to mean ALL of it.
   *
   * Retired habits live outside the Gozlin key space (they belong to the habit
   * tracker), but they are memory in every sense the user cares about: the
   * delete-habit sheet promises "Gozlin still remembers it", and the habits
   * screen tells them that record is kept for exactly as long as Gozlin's
   * memory is. Leaving them behind here would make Gozlin able to bring up a
   * habit from a past the user had just asked it to forget — which is the
   * single worst way to discover that a privacy control is partial.
   */
  const forgetMe = useCallback(async () => {
    await clearGozlinMemory();
    await saveRetiredHabits([]);
    await refreshRetired();
    setIdentity({ preferences: [], constraints: [], updatedAt: 0 });
    setMessages([]);
    setArchive([]);
    seededRef.current = false;
  }, [refreshRetired]);

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
    regenerate,
    editMessage,
    rateMessage,
    deepDive,
    resetConversation,
    deleteConversation,
    archive,
    openArchived,
    deleteArchived,
    forgetMe,
    logWeighIn,
    setGoalWeight,
    todayCheckin,
    logCheckin,
  };
}
