/**
 * useMemoryCenter — the bridge hook for the Memory Center screen.
 *
 * Connects the health-os repositories (Timeline L1, Summaries L2, Long-Term L3) and
 * Gozlin's conversation (L4) to the screen, and exposes the governance actions the
 * trust surface promises: correct (append), redact (soft-delete), tag, dismiss a
 * learned pattern, forget a milestone, and "forget everything".
 *
 * All memory logic lives in health-os/*; this hook is wiring + view-model shaping.
 */
import { useProfile } from "@/contexts/AppContext";
import {
  LongTermStore,
  memory,
  summaries,
  timeline,
  type BodyMeasurementPayload,
  type CheckinPayload,
  type CoachEpisodePayload,
  type EventSource,
  type EventType,
  type HealthEvent,
  type MealLoggedPayload,
  type NutritionDayClosedPayload,
  type WaterAddedPayload,
  type WaterDayClosedPayload,
  type WorkoutCompletedPayload,
  type WorkoutSummaryPayload,
} from "@/health-os";
import type { UserBio, UserGoals } from "@/models/user";
import {
  loadConversation,
  saveConversation,
  type GozlinEpisode,
  type GozlinIdentityMemory,
  type HabitPattern,
} from "@/services/gozlin";
import { useCallback, useEffect, useState } from "react";

// ── view-model types ──

export type EventAccent =
  | "nutrition"
  | "hydration"
  | "workout"
  | "body"
  | "mind"
  | "milestone"
  | "meta";

export interface TimelineRow {
  id: string;
  date: string;
  type: EventType;
  icon: string;
  accent: EventAccent;
  title: string;
  detail?: string;
  /** Plain-language provenance, e.g. "From your history". */
  provenance: string;
  source: EventSource;
  tags: string[];
  /** A numeric field that can be corrected in place, or null. */
  correct: { field: "calories" | "weightKg"; label: string; value: number } | null;
  raw: HealthEvent;
}

export interface TimelineDay {
  date: string;
  label: string;
  rows: TimelineRow[];
}

export interface MemorySnapshot {
  identity: GozlinIdentityMemory;
  patterns: HabitPattern[];
  episodes: GozlinEpisode[];
  conversationCount: number;
}

// ── plain-language description per event type ──

const SOURCE_LABEL: Record<EventSource, string> = {
  import: "From your history",
  user: "You logged",
  coach: "Logged by Gozlin",
  app: "Tracked",
  system: "System",
};

interface Described {
  icon: string;
  accent: EventAccent;
  title: string;
  detail?: string;
  correct?: TimelineRow["correct"];
}

function describe(e: HealthEvent): Described {
  switch (e.type) {
    case "nutrition.meal.logged": {
      const p = e.payload as MealLoggedPayload;
      return {
        icon: "restaurant-outline",
        accent: "nutrition",
        title: `Logged ${p.name}`,
        detail: p.calories != null ? `${Math.round(p.calories)} kcal` : undefined,
        correct:
          p.calories != null
            ? { field: "calories", label: "Calories (kcal)", value: Math.round(p.calories) }
            : null,
      };
    }
    case "nutrition.meal.skipped": {
      const p = e.payload as { name: string };
      return { icon: "close-circle-outline", accent: "nutrition", title: `Skipped ${p.name}` };
    }
    case "nutrition.day.closed": {
      const p = e.payload as NutritionDayClosedPayload;
      const cal = p.consumedCalories != null ? `, ${Math.round(p.consumedCalories)} kcal` : "";
      return {
        icon: "nutrition-outline",
        accent: "nutrition",
        title: `Nutrition · ${p.status}`,
        detail: `${p.mealsConsumed}/${p.totalMeals} meals${cal}`,
      };
    }
    case "hydration.day.closed": {
      const p = e.payload as WaterDayClosedPayload;
      return {
        icon: "water-outline",
        accent: "hydration",
        title: p.metGoal ? "Hydration goal hit" : "Hydration",
        detail: `${Math.round(p.ml)} ml`,
      };
    }
    case "hydration.water.added": {
      const p = e.payload as WaterAddedPayload;
      return { icon: "water-outline", accent: "hydration", title: `Water +${Math.round(p.ml)} ml` };
    }
    case "workout.session.completed": {
      const p = e.payload as WorkoutCompletedPayload;
      return {
        icon: "barbell-outline",
        accent: "workout",
        title: `Workout · ${p.sessionLabel}`,
        detail: `${p.durationMinutes} min · ${p.completionPercent}%`,
      };
    }
    case "workout.session.summary": {
      const p = e.payload as WorkoutSummaryPayload;
      return {
        icon: "fitness-outline",
        accent: "workout",
        title: `Session · ${p.sessionLabel}`,
        detail: `${p.setsCompleted}/${p.totalSets} sets`,
      };
    }
    case "body.measurement.logged": {
      const p = e.payload as BodyMeasurementPayload;
      const parts = [
        p.weightKg != null ? `${p.weightKg} kg` : null,
        p.waistCm != null ? `${p.waistCm} cm waist` : null,
      ].filter(Boolean);
      return {
        icon: "body-outline",
        accent: "body",
        title: "Weigh-in",
        detail: parts.join(" · ") || undefined,
        correct:
          p.weightKg != null
            ? { field: "weightKg", label: "Weight (kg)", value: p.weightKg }
            : null,
      };
    }
    case "checkin.logged": {
      const p = e.payload as CheckinPayload;
      const parts = [
        p.mood != null ? `mood ${p.mood}/5` : null,
        p.energy != null ? `energy ${p.energy}/5` : null,
        p.stress != null ? `stress ${p.stress}/5` : null,
        p.sleepHours != null ? `${p.sleepHours}h sleep` : null,
      ].filter(Boolean);
      return { icon: "happy-outline", accent: "mind", title: "Check-in", detail: parts.join(" · ") || undefined };
    }
    case "coach.episode": {
      const p = e.payload as CoachEpisodePayload;
      return { icon: "sparkles-outline", accent: "milestone", title: p.summary, detail: p.kind };
    }
    case "life.added": {
      const p = e.payload as { title: string; start: string; end?: string };
      return {
        icon: "calendar-outline",
        accent: "milestone",
        title: `Coming up · ${p.title}`,
        detail: p.end ? `${p.start} – ${p.end}` : p.start,
      };
    }
    case "life.resolved": {
      const p = e.payload as { title: string; resolution: string };
      return {
        icon: "calendar-clear-outline",
        accent: "meta",
        title: `Life event · ${p.resolution}`,
        detail: p.title,
      };
    }
    case "goal.set":
      return { icon: "flag-outline", accent: "meta", title: "Goal set" };
    case "goal.reached":
      return { icon: "trophy-outline", accent: "milestone", title: "Goal reached" };
    case "profile.updated":
      return { icon: "person-outline", accent: "meta", title: "Profile updated" };
    case "preference.changed":
      return { icon: "options-outline", accent: "meta", title: "Preference changed" };
    case "achievement.unlocked":
      return { icon: "ribbon-outline", accent: "milestone", title: "Achievement unlocked" };
    case "challenge.completed":
      return { icon: "checkmark-done-outline", accent: "milestone", title: "Challenge complete" };
    case "trophy.awarded":
      return { icon: "trophy-outline", accent: "milestone", title: "Trophy awarded" };
    default:
      return { icon: "ellipse-outline", accent: "meta", title: e.type };
  }
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${WEEKDAY[dt.getDay()]}, ${MONTH[(m || 1) - 1]} ${d}`;
}

function toRow(e: HealthEvent): TimelineRow {
  const d = describe(e);
  return {
    id: e.id,
    date: e.localDate,
    type: e.type,
    icon: d.icon,
    accent: d.accent,
    title: d.title,
    detail: d.detail,
    provenance: SOURCE_LABEL[e.source] ?? "Tracked",
    source: e.source,
    tags: e.tags ?? [],
    correct: d.correct ?? null,
    raw: e,
  };
}

function groupByDay(events: HealthEvent[]): TimelineDay[] {
  const byDate = new Map<string, TimelineRow[]>();
  for (const e of events) {
    const rows = byDate.get(e.localDate);
    if (rows) rows.push(toRow(e));
    else byDate.set(e.localDate, [toRow(e)]);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // most recent day first
    .map(([date, rows]) => ({
      date,
      label: dayLabel(date),
      rows: rows.sort((a, b) => (a.id < b.id ? 1 : -1)), // newest event first within a day
    }));
}

// ── the hook ──

export interface UseMemoryCenter {
  loading: boolean;
  days: TimelineDay[];
  eventCount: number;
  memory: MemorySnapshot;
  /** Settings-owned facts, read-only here (edited in Settings). */
  userBio: UserBio | null;
  userGoals: UserGoals;
  reload: () => Promise<void>;
  // timeline governance
  redactEvent: (id: string, date: string) => Promise<void>;
  tagEvent: (id: string, tags: string[]) => Promise<void>;
  correctEvent: (
    id: string,
    date: string,
    field: "calories" | "weightKg",
    value: number,
  ) => Promise<void>;
  // long-term facts
  clearMotivation: () => Promise<void>;
  removePreference: (pref: string) => Promise<void>;
  dismissPattern: (message: string) => Promise<void>;
  forgetEpisode: (id: string) => Promise<void>;
  clearConversations: () => Promise<void>;
  // nuke
  forgetEverything: () => Promise<void>;
}

const EMPTY_IDENTITY: GozlinIdentityMemory = {
  preferences: [],
  constraints: [],
  updatedAt: 0,
};

export function useMemoryCenter(): UseMemoryCenter {
  const { userBio, userGoals } = useProfile();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<TimelineDay[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [snapshot, setSnapshot] = useState<MemorySnapshot>({
    identity: EMPTY_IDENTITY,
    patterns: [],
    episodes: [],
    conversationCount: 0,
  });

  const reload = useCallback(async () => {
    const [events, identity, patterns, episodes, convo] = await Promise.all([
      timeline.query({}),
      LongTermStore.loadIdentity(),
      LongTermStore.loadBehavioral(),
      LongTermStore.loadEpisodes(),
      loadConversation(),
    ]);
    setDays(groupByDay(events));
    setEventCount(events.length);
    setSnapshot({
      identity,
      patterns,
      episodes,
      conversationCount: convo.length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const redactEvent = useCallback(
    async (id: string, date: string) => {
      await timeline.redact(id);
      await memory.recompactDay(date);
      await reload();
    },
    [reload],
  );

  const tagEvent = useCallback(
    async (id: string, tags: string[]) => {
      await timeline.tag(id, tags);
      await reload();
    },
    [reload],
  );

  const correctEvent = useCallback(
    async (id: string, date: string, field: "calories" | "weightKg", value: number) => {
      const row = days.flatMap((d) => d.rows).find((r) => r.id === id);
      if (!row) return;
      const nextPayload = { ...(row.raw.payload as Record<string, unknown>), [field]: value };
      await timeline.correct(id, nextPayload);
      await memory.recompactDay(date);
      await reload();
    },
    [days, reload],
  );

  const clearMotivation = useCallback(async () => {
    await LongTermStore.clearMotivation();
    await reload();
  }, [reload]);

  const removePreference = useCallback(
    async (pref: string) => {
      await LongTermStore.removePreference(pref);
      await reload();
    },
    [reload],
  );

  const dismissPattern = useCallback(
    async (message: string) => {
      await LongTermStore.dismissPattern(message);
      await reload();
    },
    [reload],
  );

  const forgetEpisode = useCallback(
    async (id: string) => {
      await LongTermStore.forgetEpisode(id);
      await reload();
    },
    [reload],
  );

  const clearConversations = useCallback(async () => {
    await saveConversation([]);
    await reload();
  }, [reload]);

  const forgetEverything = useCallback(async () => {
    await timeline.eraseHard(() => true);
    await summaries.clear();
    await LongTermStore.clearAll();
    await reload();
  }, [reload]);

  return {
    loading,
    days,
    eventCount,
    memory: snapshot,
    userBio,
    userGoals,
    reload,
    redactEvent,
    tagEvent,
    correctEvent,
    clearMotivation,
    removePreference,
    dismissPattern,
    forgetEpisode,
    clearConversations,
    forgetEverything,
  };
}
