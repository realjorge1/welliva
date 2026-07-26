/**
 * health-os/memory/LongTermStore.ts
 *
 * Layer 3 (Long-Term Memory) — the durable facts the coach must never forget:
 * the user's motivation/"why", stated preferences & constraints, learned behavioral
 * patterns, and episodic milestones.
 *
 * This is a RE-HOME, not a rewrite: L3 already exists as Welliva's on-device Gozlin
 * memory (`@gozlin_identity` / `_behavioral` / `_episodic`). This module gives it a
 * domain home and a layer-framed API the Memory Center reads — storage and behavior
 * are unchanged (docs/architecture/03-memory-architecture.md §2). A later milestone
 * may relocate the underlying store; nothing here changes when it does.
 */
import {
  addEpisode,
  clearGozlinMemory,
  loadBehavioral,
  loadEpisodes,
  loadIdentity,
  loadMemorySnapshot,
  rememberMotivation,
  rememberPreference,
  removeEpisode,
  saveBehavioral,
  saveIdentity,
  type GozlinEpisode,
  type GozlinIdentityMemory,
  type GozlinMemorySnapshot,
  type HabitPattern,
} from "@/services/gozlin";

export type {
  GozlinEpisode as Milestone,
  GozlinIdentityMemory as IdentityFacts,
  GozlinMemorySnapshot as LongTermSnapshot,
  HabitPattern as LearnedPattern,
};

/** The durable-facts façade (layer 3). Thin delegation to the existing Gozlin store. */
export const LongTermStore = {
  // identity facts
  loadIdentity,
  saveIdentity,
  rememberMotivation,
  rememberPreference,
  /** Remove the stored "why". */
  async clearMotivation(): Promise<void> {
    await saveIdentity({ motivation: undefined });
  },
  /** Drop one stated preference. */
  async removePreference(pref: string): Promise<GozlinIdentityMemory> {
    const id = await loadIdentity();
    return saveIdentity({ preferences: id.preferences.filter((p) => p !== pref) });
  },

  // learned behavioral patterns
  loadBehavioral,
  /** Dismiss one learned pattern (by its message). */
  async dismissPattern(message: string): Promise<HabitPattern[]> {
    const list = await loadBehavioral();
    const next = list.filter((p) => p.message !== message);
    await saveBehavioral(next);
    return next;
  },

  // episodic milestones
  loadEpisodes,
  addEpisode,
  /** Forget one milestone (by id). */
  forgetEpisode: removeEpisode,

  // aggregate + reset
  loadSnapshot: loadMemorySnapshot,
  /** "Forget everything" Gozlin remembers (L3 + L4 conversation + check-ins). */
  clearAll: clearGozlinMemory,
} as const;

export type { GozlinMemorySnapshot };
