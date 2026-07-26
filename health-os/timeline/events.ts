/**
 * health-os/timeline/events.ts
 *
 * The HealthEvent envelope — the immutable unit of the Timeline (Memory layer L1,
 * the single source of truth). See docs/architecture/02-data-and-schema.md §2.
 */
import { localISONow, monthKeyOf, todayDate } from "../platform/clock";
import { ulid } from "../platform/id";

export type EventSource = "app" | "coach" | "user" | "import" | "system";

/** Namespaced event types: `domain.entity.verb`. The catalog (catalog.ts) holds the payload shape + version per type. */
export type EventType =
  | "nutrition.meal.logged"
  | "nutrition.meal.skipped"
  | "nutrition.day.closed"
  | "hydration.water.added"
  | "hydration.day.closed"
  | "workout.session.completed"
  | "workout.session.summary"
  | "body.measurement.logged"
  | "checkin.logged"
  | "goal.set"
  | "goal.reached"
  | "profile.updated"
  | "preference.changed"
  | "achievement.unlocked"
  | "challenge.completed"
  | "trophy.awarded"
  | "coach.episode"
  | "life.added"
  | "life.resolved";

export interface EventOrigin {
  surface?: string;
  sessionId?: string;
  note?: string;
}

export interface HealthEvent<T = unknown> {
  /** ULID — unique AND time-sortable. */
  id: string;
  type: EventType;
  /** ISO-8601 WITH local offset (never bare UTC). */
  ts: string;
  /** YYYY-MM-DD in LOCAL time — partition + daily-projection key. */
  localDate: string;
  source: EventSource;
  /** Version of THIS event type's payload (per-type evolution). */
  v: number;
  payload: T;
  origin?: EventOrigin;
  /** Soft-delete (Memory Center). Excluded from every read/summary. */
  redacted?: boolean;
  /** If this corrects an earlier event, its id (correction-by-append). */
  supersedes?: string;
  /** User-applied categories. */
  tags?: string[];
}

export interface BuildEventInput<T> {
  type: EventType;
  payload: T;
  localDate?: string;
  ts?: string;
  source?: EventSource;
  v?: number;
  /** Provide a deterministic id (e.g. ulidFromSeed) for idempotent imports. */
  id?: string;
  origin?: EventOrigin;
  supersedes?: string;
  tags?: string[];
}

/** Construct a well-formed HealthEvent, filling defaults (today / now / random id). */
export function buildEvent<T>(input: BuildEventInput<T>): HealthEvent<T> {
  const localDate = input.localDate ?? todayDate();
  const event: HealthEvent<T> = {
    id: input.id ?? ulid(),
    type: input.type,
    ts: input.ts ?? localISONow(),
    localDate,
    source: input.source ?? "app",
    v: input.v ?? 1,
    payload: input.payload,
  };
  if (input.origin) event.origin = input.origin;
  if (input.supersedes) event.supersedes = input.supersedes;
  if (input.tags && input.tags.length) event.tags = input.tags;
  return event;
}

/** The month-partition key (`YYYY-MM`) an event belongs to. */
export function monthOf(event: HealthEvent): string {
  return monthKeyOf(event.localDate);
}
