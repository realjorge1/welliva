/**
 * health-os/modules/types.ts — the HealthModule plugin contract (blueprint §5).
 *
 * The dependency rule already makes the platform extensible ("a new feature = new event
 * types + a new engine reading Context"); this NAMES the contract so the companion's
 * capabilities — and future ones (sleep, glucose, mental-health) — register uniformly
 * instead of being wired by hand. A module touches the core only through these slots; it
 * cannot reach into another domain (the existing no-restricted-imports lint enforces it).
 *
 * The slots are intentionally light today — only what has live consumers (senses,
 * notifications, timeline event types, consent). Context/insight slots fill in as M2
 * (Context read-model) lands. See docs/companion/00-proactive-companion-blueprint.md §5.
 */
import type { ConsentCategory } from "../privacy";
import type { SignalStatus } from "../signals/types";

/** A uniform handle over an external sense (calendar, weather, wearable, photo, voice, …). */
export interface SignalSourceRef {
  id: string;
  label: string;
  /** Consent category that gates it. */
  consent: ConsentCategory;
  /** Live status (consent + OS permission). Degrades to `unavailable` off the dev build. */
  getStatus: () => Promise<SignalStatus>;
}

export interface HealthModule {
  /** Stable id (kebab-case). */
  id: string;
  title: string;
  description: string;
  /** Timeline event types this module introduces (catalog names). */
  eventTypes?: string[];
  /** Consent categories this module is gated by. */
  consent?: ConsentCategory[];
  /** External senses this module contributes. */
  signalSources?: SignalSourceRef[];
  /** True if this module emits proactive notification candidates. */
  producesNotifications?: boolean;
}

/** A module's resolved status row (for the module directory / "what's watching"). */
export interface ModuleSignalStatus {
  moduleId: string;
  sourceId: string;
  label: string;
  consent: ConsentCategory;
  status: SignalStatus;
}
