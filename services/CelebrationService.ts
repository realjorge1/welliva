/**
 * CELEBRATION SERVICE — one unlock moment, many sources.
 *
 * Achievements, monthly-challenge completions, and goal/chapter milestones all
 * deserve a celebration, but they're different data shapes. This normalizes each
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
import {
  TIER_META,
  type AchievementDef,
  type AchievementSummary,
  type AchievementTier,
} from "./AchievementService";
import { periodLabel, type ChallengeDef } from "./ChallengeService";
import type { Trophy } from "./TournamentService";

export type CelebrationKind = "achievement" | "challenge" | "chapter" | "trophy";

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
  const maturity = userMaturity(summary);
  return {
    id: `ach:${def.id}`,
    kind: "achievement",
    eyebrow: def.tier === "mythic" ? "MYTHIC ACHIEVEMENT" : "ACHIEVEMENT UNLOCKED",
    title: def.name,
    description: def.description,
    icon: def.icon,
    accent: tier.color,
    badgeIcon: "medal",
    badgeLabel: `${tier.label} · +${tier.points} pts`,
    intensity: achievementIntensity(def.tier, maturity),
    meta:
      maturity > 0.45
        ? `${summary.earnedCount} of ${summary.total} unlocked · Level ${summary.level}`
        : undefined,
  };
}

export function celebrationFromChallenge(def: ChallengeDef): Celebration {
  return {
    id: `chal:${def.id}`,
    kind: "challenge",
    eyebrow: "CHALLENGE COMPLETE",
    title: def.title,
    description: def.description,
    icon: def.icon,
    accent: def.accent,
    badgeIcon: "ribbon",
    badgeLabel: `Monthly Challenge · +${def.points} pts`,
    intensity: 0.92,
  };
}

/**
 * A won-month Trophy → a full-fanfare celebration. Trophies are rare (one per
 * month, max) and only ever earned, so they always go all-in regardless of
 * maturity. Accent is the trophy's tier color; the medallion gradient, confetti
 * palette, and glow all follow it.
 */
export function celebrationForTrophy(trophy: Trophy): Celebration {
  const month = periodLabel(trophy.periodKey).split(" ")[0];
  return {
    id: `trophy:${trophy.id}`,
    kind: "trophy",
    eyebrow: "TROPHY EARNED",
    title: trophy.title,
    description: `You kept pace with ${trophy.rivalName} all month and finished strong. This trophy is yours for good.`,
    icon: trophy.icon,
    accent: trophy.accent,
    badgeIcon: "trophy",
    badgeLabel: `Consistency League · ${month}`,
    intensity: 1,
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
    badgeIcon: "sparkles",
    badgeLabel: "A new chapter awaits",
    intensity: 1,
    cta: { label: "Begin next chapter", route: "/new-chapter", icon: "arrow-forward" },
  };
}
