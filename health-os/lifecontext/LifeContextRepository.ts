/**
 * health-os/lifecontext/LifeContextRepository.ts
 *
 * The ONLY code that reads/writes the Life Context store. Life entries are mutable
 * forward-looking STATE (like Goals/Preferences settings), so the canonical list lives
 * under one key; but every meaningful transition ALSO appends a `life.*` Timeline event
 * so the unified Memory (and the Memory Center / future Story engine) sees it — keeping
 * the "one memory, many features" principle (docs/architecture/01 §4 rule 5).
 *
 * Lifecycle: active → completed | dismissed (user) | expired (auto, the grace sweep).
 * See docs/companion/00-proactive-companion-blueprint.md §3.1.
 */
import { localISONow, toLocalDateString } from "../platform/clock";
import { ulid } from "../platform/id";
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import { K } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import { buildEvent } from "../timeline/events";
import {
  timeline as defaultTimeline,
  TimelineRepository,
} from "../timeline/TimelineRepository";
import {
  computeExpiresAt,
  DEFAULT_HORIZON_DAYS,
  daysUntil,
  isExpired,
  isValidDate,
  phaseOf,
  type LifeEvent,
  type LifeEventKind,
  type LifeEventSource,
  type LifeWindow,
} from "./lifecontext.types";

export interface LifeEventInput {
  kind: LifeEventKind;
  title: string;
  window: LifeWindow;
  /** Default "user". Calendar/inferred sources arrive with Signals (P3+). */
  source?: LifeEventSource;
  /** Default 1.0. */
  confidence?: number;
  note?: string;
  /** Deterministic id (e.g. from a calendar event) → idempotent import. */
  id?: string;
}

export interface ListOptions {
  /** Include terminal (completed/dismissed/expired) entries. Default false. */
  includeResolved?: boolean;
}

type Resolution = "completed" | "dismissed" | "expired";

export class LifeContextRepository {
  constructor(
    private readonly store: KeyValueStore = defaultStore,
    private readonly timeline: TimelineRepository = defaultTimeline,
  ) {}

  // ── persistence ──

  private all(): Promise<LifeEvent[]> {
    return this.store.get<LifeEvent[]>(K.LIFECONTEXT, []);
  }

  private async save(events: LifeEvent[]): Promise<void> {
    // Keep the canonical list ordered by window start (then id) so reads are stable.
    events.sort((a, b) =>
      a.window.start === b.window.start
        ? a.id < b.id
          ? -1
          : 1
        : a.window.start < b.window.start
          ? -1
          : 1,
    );
    await this.store.set(K.LIFECONTEXT, events);
  }

  // ── writes ──

  /**
   * Register a forward-looking life event. Validates the window, computes the auto-expiry
   * day, persists, and appends a `life.added` Timeline event. Idempotent on `id`.
   */
  async add(input: LifeEventInput, now: Date = new Date()): Promise<LifeEvent> {
    if (!input.title.trim()) throw new Error("Life event needs a title");
    if (!isValidDate(input.window.start)) {
      throw new Error(`Invalid start date: ${input.window.start}`);
    }
    if (input.window.end !== undefined && !isValidDate(input.window.end)) {
      throw new Error(`Invalid end date: ${input.window.end}`);
    }
    if (input.window.end !== undefined && input.window.end < input.window.start) {
      throw new Error("End date cannot precede start date");
    }

    const list = await this.all();
    if (input.id) {
      const existing = list.find((e) => e.id === input.id);
      if (existing) return existing; // idempotent re-import
    }

    const nowIso = localISONow(now);
    const event: LifeEvent = {
      id: input.id ?? ulid(now.getTime()),
      kind: input.kind,
      title: input.title.trim(),
      window: input.window.end
        ? { start: input.window.start, end: input.window.end }
        : { start: input.window.start },
      source: input.source ?? "user",
      confidence: input.confidence ?? 1,
      status: "active",
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: computeExpiresAt(input.window),
    };

    list.push(event);
    await this.save(list);

    await this.timeline.append(
      buildEvent({
        type: "life.added",
        source: event.source === "user" ? "user" : "import",
        localDate: toLocalDateString(now),
        ts: nowIso,
        payload: {
          refId: event.id,
          kind: event.kind,
          title: event.title,
          start: event.window.start,
          ...(event.window.end ? { end: event.window.end } : {}),
          source: event.source,
        },
      }),
    );

    return event;
  }

  /** Edit a still-active entry. Recomputes expiry if the window changed. */
  async update(
    id: string,
    patch: Partial<Pick<LifeEvent, "title" | "kind" | "note">> & {
      window?: LifeWindow;
    },
    now: Date = new Date(),
  ): Promise<LifeEvent | null> {
    const list = await this.all();
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const prev = list[idx];
    if (patch.window) {
      if (!isValidDate(patch.window.start)) throw new Error("Invalid start date");
      if (patch.window.end !== undefined && !isValidDate(patch.window.end)) {
        throw new Error("Invalid end date");
      }
    }
    const window = patch.window ?? prev.window;
    const next: LifeEvent = {
      ...prev,
      ...(patch.title ? { title: patch.title.trim() } : {}),
      ...(patch.kind ? { kind: patch.kind } : {}),
      ...(patch.note !== undefined
        ? patch.note.trim()
          ? { note: patch.note.trim() }
          : { note: undefined }
        : {}),
      window,
      expiresAt: computeExpiresAt(window),
      updatedAt: localISONow(now),
    };
    list[idx] = next;
    await this.save(list);
    return next;
  }

  private async resolve(
    id: string,
    resolution: Resolution,
    now: Date,
  ): Promise<LifeEvent | null> {
    const list = await this.all();
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const prev = list[idx];
    if (prev.status !== "active") return prev; // already terminal — no double-resolve
    const nowIso = localISONow(now);
    const next: LifeEvent = {
      ...prev,
      status: resolution,
      resolvedAt: nowIso,
      updatedAt: nowIso,
    };
    list[idx] = next;
    await this.save(list);

    await this.timeline.append(
      buildEvent({
        type: "life.resolved",
        source: resolution === "dismissed" ? "user" : "app",
        localDate: toLocalDateString(now),
        ts: nowIso,
        payload: {
          refId: next.id,
          kind: next.kind,
          title: next.title,
          resolution,
        },
      }),
    );
    return next;
  }

  /** User marks it done (it happened). */
  complete(id: string, now: Date = new Date()): Promise<LifeEvent | null> {
    return this.resolve(id, "completed", now);
  }

  /** User removes it from the forward view (no longer relevant). */
  dismiss(id: string, now: Date = new Date()): Promise<LifeEvent | null> {
    return this.resolve(id, "dismissed", now);
  }

  /**
   * The auto-expiry sweep: terminate every active entry whose grace day has passed.
   * Run at day-rollover (and on boot). Returns the number expired.
   */
  async expireDue(now: Date = new Date()): Promise<number> {
    const today = toLocalDateString(now);
    const list = await this.all();
    const due = list.filter((e) => e.status === "active" && isExpired(e, today));
    for (const e of due) await this.resolve(e.id, "expired", now);
    return due.length;
  }

  /** Hard delete (privacy / "forget"). Truly removes the entry from the store. */
  async remove(id: string): Promise<boolean> {
    const list = await this.all();
    const kept = list.filter((e) => e.id !== id);
    if (kept.length === list.length) return false;
    await this.save(kept);
    return true;
  }

  /** Wipe the whole Life Context store (the "forget everything" hook). */
  async clear(): Promise<void> {
    await this.store.remove(K.LIFECONTEXT);
  }

  // ── reads ──

  get(id: string): Promise<LifeEvent | undefined> {
    return this.all().then((l) => l.find((e) => e.id === id));
  }

  /** Every entry (ordered by start). Excludes terminal ones unless asked. */
  async list(opts: ListOptions = {}): Promise<LifeEvent[]> {
    const list = await this.all();
    return opts.includeResolved ? list : list.filter((e) => e.status === "active");
  }

  /** Active entries that haven't fully passed, soonest first. */
  async listActive(now: Date = new Date()): Promise<LifeEvent[]> {
    const today = toLocalDateString(now);
    const list = await this.all();
    return list
      .filter((e) => e.status === "active" && phaseOf(e, today) !== "past")
      .sort((a, b) => daysUntil(a, today) - daysUntil(b, today));
  }

  /** Active entries whose start falls within `horizonDays` (the "what's coming up" feed). */
  async listUpcoming(
    horizonDays: number = DEFAULT_HORIZON_DAYS,
    now: Date = new Date(),
  ): Promise<LifeEvent[]> {
    const today = toLocalDateString(now);
    const active = await this.listActive(now);
    return active.filter((e) => {
      const d = daysUntil(e, today);
      return d <= horizonDays; // already excludes fully-past via listActive
    });
  }
}

/** The default, app-wide Life Context repository. */
export const lifeContext = new LifeContextRepository(defaultStore, defaultTimeline);
