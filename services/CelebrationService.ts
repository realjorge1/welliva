/**
 * CELEBRATION SERVICE — one unlock moment, many sources.
 *
 * Achievements, coach-noticed moments, goal/chapter milestones and the day's
 * kept commitment all deserve a moment, but they're different data shapes.
 * This normalizes each into one `Celebration` the global host
 * (components/AchievementCelebration) renders — so a new celebratable event is
 * one builder away, not a new modal.
 *
 * ── WHAT CHANGED 2026-10-15 ─────────────────────────────────────────────────
 *
 * The confetti cannon is gone, and with it the "maturity dial" (`intensity`)
 * that existed only to decide how much confetti to fire. The owner's verdict on
 * the old moment was "too noisy, too amateur — and boring"; the brief was
 * Duolingo — one simple object, beautifully timed. So a celebration is now ONE
 * hero: the badge you earned (struck in its own metal) for an achievement, a
 * moment or a chapter, and the flame for a kept day. Veterans still get the
 * quiet `meta` data line — more data, never more spectacle.
 */

import { Ionicons } from "@expo/vector-icons";
import { Palette } from "../constants/theme";
import type { Moment } from "./MomentEngine";
import { badgeFinish, finishFromAccent, type BadgeFinish } from "./achievementBadges";
import {
  TIER_META,
  type AchievementDef,
  type AchievementSummary,
} from "./AchievementService";
import {
  commitmentLine,
  isMilestone,
  type CommitmentDay,
  type CommitmentState,
} from "./commitment";

export type CelebrationKind = "achievement" | "chapter" | "moment" | "commitment";

export interface CelebrationCTA {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** The day a commitment was kept — what the flame screen shows. */
export interface CommitmentMoment {
  /** The run after today. */
  streak: number;
  /** The run the count rolls up FROM (0 on a first day or after a break). */
  previous: number;
  /** Mon → Sun, today kept. */
  week: CommitmentDay[];
  /** The one line under the count. */
  line: string;
  /** A run length with its own words (7, 14, 30, 100 …). */
  milestone: boolean;
}

export interface Celebration {
  /** Unique per event so the queue de-dupes and the entrance re-plays. */
  id: string;
  kind: CelebrationKind;
  /** Small uppercase label above the hero. */
  eyebrow: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** The single colour that stands for this moment (pill, accents). */
  accent: string;
  /**
   * The material the medallion is struck in — a three-stop ramp plus the ink
   * its glyph is cut in. An achievement brings its own (see achievementBadges);
   * a chapter or a moment has one derived from its tone.
   */
  finish: BadgeFinish;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badgeLabel: string;
  /** A quiet stat line shown to mature users ("more data, less spectacle"). */
  meta?: string;
  /** Optional next step (the chapter pivot). */
  cta?: CelebrationCTA;
  /** Present on `commitment` celebrations only. */
  commitment?: CommitmentMoment;
}

/**
 * 0 (brand-new) → 1 (seasoned). Blends how far up the level ladder the user is
 * with how much of the trophy case they've opened, so neither signal alone
 * over- or under-states maturity.
 */
export function userMaturity(summary: AchievementSummary): number {
  const byLevel = (summary.level - 1) / 8; // ~level 9 → 1
  const byBreadth = summary.earnedCount / 24; // ~24 unlocks → 1
  return Math.max(0, Math.min(1, (byLevel + byBreadth) / 2));
}

export function celebrationFromAchievement(
  def: AchievementDef,
  summary: AchievementSummary,
): Celebration {
  const tier = TIER_META[def.tier];
  // The BADGE's own metal, not the tier's. Every bronze used to arrive as the
  // same orange disc; each one is now the thing it commemorates.
  const finish = badgeFinish(def);
  const maturity = userMaturity(summary);
  return {
    id: `ach:${def.id}`,
    kind: "achievement",
    eyebrow: def.tier === "mythic" ? "MYTHIC ACHIEVEMENT" : "ACHIEVEMENT UNLOCKED",
    title: def.name,
    description: def.description,
    icon: def.icon,
    accent: finish.accent,
    finish,
    badgeIcon: "medal",
    badgeLabel: `${tier.label} · +${tier.points} pts`,
    meta:
      maturity > 0.45
        ? `${summary.earnedCount} of ${summary.total} unlocked · Level ${summary.level}`
        : undefined,
  };
}

export function celebrationForChapter(opts: {
  chapter: number;
  goalLabel: string;
  accent: string;
}): Celebration {
  return {
    id: `chapter:${opts.chapter}`,
    kind: "chapter",
    eyebrow: "GOAL REACHED",
    title: "Chapter Complete",
    description: `You reached your ${opts.goalLabel.toLowerCase()} goal. The journey doesn't end here — let's choose what's next.`,
    icon: "trophy",
    accent: opts.accent,
    finish: finishFromAccent(opts.accent),
    badgeIcon: "sparkles",
    badgeLabel: "A new chapter awaits",
    cta: { label: "Begin next chapter", route: "/new-chapter", icon: "arrow-forward" },
  };
}

/**
 * A coach-noticed moment → a celebration.
 *
 * The eyebrow is the coach speaking rather than the system announcing, which is
 * the whole difference between this and a badge: "GOZLIN NOTICED" is somebody
 * paying attention, "ACHIEVEMENT UNLOCKED" is a vending machine.
 */
export function celebrationFromMoment(moment: Moment): Celebration {
  const TONE: Record<Moment["tone"], string> = {
    gold: Palette.gold,
    flame: Palette.brand,
    water: Palette.water,
    success: Palette.positive,
  };
  return {
    id: moment.id,
    kind: "moment",
    eyebrow: "GOZLIN NOTICED",
    title: moment.title,
    description: moment.line,
    icon: moment.icon,
    accent: TONE[moment.tone],
    finish: finishFromAccent(TONE[moment.tone]),
    badgeIcon: "eye",
    badgeLabel: "From your own history",
  };
}

/** The flame's own orange — fixed, like the flame (see components/celebration/Flame). */
const FLAME_ACCENT = "#FF8A1C";

/**
 * Today was kept → the flame screen. Fired once per day, the moment the first
 * thing that counts is logged (see useGamificationState).
 *
 * `previous` is what the count rolls up FROM: yesterday's run when today
 * extends it, 0 when today starts a new one — so a first day reads 0 → 1, and a
 * comeback never pretends to have continued anything.
 */
export function celebrationForCommitment(
  state: CommitmentState,
  today: string,
): Celebration {
  const streak = Math.max(1, state.streak);
  return {
    id: `commit:${today}`,
    kind: "commitment",
    eyebrow: "KEPT TODAY",
    title: `${streak} day streak`,
    description: commitmentLine(streak, state.totalDays, today),
    icon: "flame",
    accent: FLAME_ACCENT,
    finish: finishFromAccent(FLAME_ACCENT),
    badgeIcon: "flame",
    badgeLabel: `Best ${Math.max(state.best, streak)}`,
    commitment: {
      streak,
      previous: streak - 1,
      week: state.week,
      line: commitmentLine(streak, state.totalDays, today),
      milestone: isMilestone(streak),
    },
  };
}
