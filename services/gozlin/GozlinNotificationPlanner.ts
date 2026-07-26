/**
 * GOZLIN — Notification Planner (Proactive Companion P2).
 *
 * PURE mapping from Gozlin's in-app surfaces (the daily briefing, ranked anticipations,
 * and a ready long-horizon story) into generic `NotificationCandidate`s the health-os
 * attention-budget orchestrator can schedule. It invents nothing — it reuses copy and
 * priorities already computed by the deterministic engines, so a pushed notification says
 * exactly what the in-app card would.
 *
 * Lives here (not in health-os) so the domain layer never imports `services/` — the
 * dependency rule. See docs/companion/00-proactive-companion-blueprint.md §3.4.
 */
import type { NotificationCandidate } from "@/health-os";
import type { GozlinBriefing } from "./gozlin.types";
import type { Anticipation } from "./GozlinAnticipationEngine";

export interface NotificationCandidateInput {
  /** The local date the plan is for (`YYYY-MM-DD`) — briefing ids are stamped with it. */
  forDate: string;
  /** Today's briefing, if one was built. Becomes the morning candidate. */
  briefing?: GozlinBriefing | null;
  /** Ranked anticipations (AnticipationResult.anticipations). */
  anticipations?: Anticipation[];
  /** A ready story recap (P6), if any. */
  story?: { id: string; title: string; body: string; route?: string } | null;
  /** Only anticipations at/above this leverage become candidates. */
  minAnticipationPriority?: number;
  /** Preferred local delivery times ("HH:MM"). */
  times?: { briefing?: string; anticipation?: string; story?: string };
}

const DEFAULT_TIMES = { briefing: "08:00", anticipation: "18:00", story: "10:00" };

/** Trim a coaching line to a notification-friendly length on a sentence boundary. */
function clip(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + "…";
}

export function buildNotificationCandidates(
  input: NotificationCandidateInput,
): NotificationCandidate[] {
  const times = { ...DEFAULT_TIMES, ...(input.times ?? {}) };
  const minPriority = input.minAnticipationPriority ?? 68;
  const out: NotificationCandidate[] = [];

  // ── the morning briefing (one per day; date-stamped id so it recurs) ──
  if (input.briefing) {
    const b = input.briefing;
    const title =
      b.dayCount != null ? `Day ${b.dayCount} · ${b.journeyLabel}` : "Your morning briefing";
    out.push({
      id: `briefing:${input.forDate}`,
      category: "briefing",
      title,
      body: clip(`${b.headline} ${b.microAction}`),
      priority: 50,
      preferredTime: times.briefing,
      route: "/gozlin",
    });
  }

  // ── anticipations (send-once by their stable id; only the high-leverage ones) ──
  for (const a of input.anticipations ?? []) {
    if (a.priority < minPriority) continue;
    out.push({
      id: `ant:${a.id}`,
      category: "anticipation",
      title: a.title,
      body: clip(a.message),
      priority: a.priority,
      preferredTime: times.anticipation,
      route: "/life",
    });
  }

  // ── a ready long-horizon story (P6) ──
  if (input.story) {
    out.push({
      id: `story:${input.story.id}`,
      category: "story",
      title: input.story.title,
      body: clip(input.story.body),
      priority: 64,
      preferredTime: times.story,
      ...(input.story.route ? { route: input.story.route } : {}),
    });
  }

  return out;
}
