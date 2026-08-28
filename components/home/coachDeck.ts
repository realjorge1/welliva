/**
 * coachDeck — the Home "Your coach" cards, plus the extra Gozlin habit card.
 *
 * The habit card is derived straight from the deterministic Habit Awareness
 * report (a learned pattern, else the behavior headline). It only appears when
 * there's a real, evidence-backed thing to say — never a fabricated one.
 */
import type { CoachInsight } from "@/services/intelligence";
import type { GozlinHabitReport, HabitPattern } from "@/services/gozlin";

export interface CoachCard extends CoachInsight {
  /** The Gozlin habit-awareness card — opens the deep-dive framed on habits. */
  isHabit?: boolean;
}

function patternTitle(p: HabitPattern): string {
  switch (p.kind) {
    case "anchor":
      return "Your keystone habit";
    case "skip":
      return "A slip I've spotted";
    case "mood_link":
    case "sleep_link":
      return "A connection I've noticed";
    case "bad_habit":
      return "Worth catching";
    case "weekend_dip":
      return "Your weekend pattern";
    case "consistency":
      return "Your rhythm";
    default:
      return "What I've learned about you";
  }
}

function patternTone(p: HabitPattern): CoachInsight["tone"] {
  if (p.kind === "anchor" || p.kind === "consistency") return "positive";
  if (p.kind === "skip" || p.kind === "bad_habit") return "warning";
  return "nudge";
}

/**
 * Build the Gozlin habit card from the report, or null when there's nothing
 * evidence-backed to surface yet (a brand-new user).
 */
/**
 * One learned pattern as a coach card.
 *
 * Extracted so the weekly Home insight and the carousel card are the SAME
 * object: tapping either opens the deep-dive on identical framing. Two
 * hand-rolled mappings would eventually disagree about a pattern's title or
 * tone, and the user would meet the same finding wearing two different faces.
 */
export function cardFromPattern(p: HabitPattern, id = "gozlin-habit"): CoachCard {
  return {
    id,
    type: "motivation",
    tone: patternTone(p),
    icon: p.icon ?? "sparkles",
    title: patternTitle(p),
    message: p.message,
    priority: 6,
    isHabit: true,
  };
}

export function buildHabitCard(report: GozlinHabitReport): CoachCard | null {
  if (report.patterns.length > 0) {
    return cardFromPattern(report.patterns[0]);
  }

  // No learned pattern yet, but if we already have a real behavior read, cite the
  // strongest domain concretely rather than inventing a specifics-free "tip".
  if (!report.dataLimited && report.behaviorScores.length > 0) {
    const top = [...report.behaviorScores].sort((a, b) => b.score - a.score)[0];
    return {
      id: "gozlin-habit",
      type: "motivation",
      tone: top.score >= 60 ? "positive" : "nudge",
      icon: top.icon ?? "pulse",
      title: "Your strongest habit",
      message: `${top.label} is ${top.band.toLowerCase()} — ${top.drivers[0] ?? `${top.score}/100`}.`,
      priority: 6,
      isHabit: true,
    };
  }

  return null;
}

/**
 * Curate the "Your coach" deck: distinct cards only (one per insight type, so we
 * never show two nutrition/streak cards), the Gozlin habit card when there's a
 * real learned thing, capped at 4. More surface naturally as the user logs more
 * and more insight types start firing.
 */
export function buildCoachDeck(
  insights: CoachInsight[],
  habitCard: CoachCard | null,
): CoachCard[] {
  const byType = new Map<string, CoachInsight>();
  for (const i of insights) {
    const cur = byType.get(i.type);
    if (!cur || i.priority > cur.priority) byType.set(i.type, i);
  }
  let distinct = [...byType.values()].sort((a, b) => b.priority - a.priority) as CoachCard[];

  // A real habit card replaces the generic "you're doing great" filler.
  if (habitCard) distinct = distinct.filter((c) => c.type !== "motivation");

  return habitCard ? [...distinct.slice(0, 3), habitCard] : distinct.slice(0, 4);
}

/** Map an insight tone to a role name the deep-dive + card resolve to a color. */
export function toneKey(tone: CoachInsight["tone"]): "success" | "warning" | "primary" {
  return tone === "positive" ? "success" : tone === "warning" ? "warning" : "primary";
}
