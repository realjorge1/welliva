/**
 * CELEBRATION SERVICE — one unlock moment, many sources.
 *
 * Achievements, coach-noticed moments, and goal/chapter milestones all deserve
 * a celebration, but they're different data shapes. This normalizes each
 * into one `Celebration` the global host (components/AchievementCelebration)
 * renders — so a new celebratable event is one builder away, not a new modal.
 *
 * It also owns the MATURITY DIAL. A years-long product can't pop full confetti
 * for every bronze badge forever — celebration is a currency, and over-printing
 * it makes the big moments feel cheap. So fanfare `intensity` scales with the
 * event's weight AND the user's maturity: a newcomer's first water badge roars;
 * a seasoned user's bronze gets a tasteful flourish, while their platinum,
 * mythic, challenge, and chapter moments still go all-in. Veterans also get a
 * little more *data* (a quiet meta line) in place of the spectacle.
 */

import { Ionicons } from "@expo/vector-icons";
import { Palette } from "../constants/theme";
import type { Moment } from "./MomentEngine";
import { badgeFinish, finishFromAccent, type BadgeFinish } from "./achievementBadges";
import {
  TIER_META,
  type AchievementDef,
  type AchievementSummary,
  type AchievementTier,
} from "./AchievementService";
export type CelebrationKind = "achievement" | "chapter" | "moment";

export interface CelebrationCTA {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface Celebration {
  /** Unique per event so the queue de-dupes and the burst re-keys. */
  id: string;
  kind: CelebrationKind;
  /** Small uppercase label above the medallion. */
  eyebrow: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Drives the medallion gradient, glow, confetti palette, and border. */
  accent: string;
  /**
   * The material the medallion is struck in — a three-stop ramp plus the ink
   * its glyph is cut in. An achievement brings its own (see achievementBadges);
   * a chapter or a moment has one derived from its tone.
   */
  finish: BadgeFinish;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badgeLabel: string;
  /** 0–1 fanfare — the maturity dial. Scales confetti volume + the shockwave. */
  intensity: number;
  /** A quiet stat line shown to mature users ("more data, less confetti"). */
  meta?: string;
  /** Optional next step (the chapter pivot). */
  cta?: CelebrationCTA;
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

const TIER_BASE: Record<AchievementTier, number> = {
  bronze: 0.55,
  silver: 0.7,
  gold: 0.92,
  platinum: 1,
  mythic: 1,
};

function achievementIntensity(tier: AchievementTier, maturity: number): number {
  const base = TIER_BASE[tier];
  // Only the everyday tiers dial down for veterans; the rare ones always roar.
  const damp = tier === "bronze" || tier === "silver" ? 1 - 0.55 * maturity : 1;
  return Math.max(0.3, base * damp);
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
    intensity: achievementIntensity(def.tier, maturity),
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
    intensity: 1,
    cta: { label: "Begin next chapter", route: "/new-chapter", icon: "arrow-forward" },
  };
}

/**
 * A coach-noticed moment → a celebration.
 *
 * Deliberately quieter than an achievement (0.72 rather than a tier base), and
 * deliberately NOT dialled down by maturity. The maturity dial exists because a
 * veteran has seen the same bronze badge a hundred times — but a moment is
 * defined against that user's own history, so a seasoned user's moment is by
 * construction rarer and more meaningful than a newcomer's, not less. Damping
 * it would silence exactly the people it is most true for.
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
    intensity: 0.72,
  };
}
