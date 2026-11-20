/**
 * Migration 005 — catch the learning model up on the days it never saw.
 *
 * Until 2026-11-20 nothing but migration 001's one-time backfill wrote closed
 * food days and weigh-ins to the timeline (see health-os/timeline/writers). So
 * every device that ran 001 holds those events only up to the day it ran, and
 * a device that installed later holds none at all — while diet history and the
 * weight log kept growing beside them.
 *
 * This replays both stores into the timeline FOR DATES THE TIMELINE IS MISSING:
 *   · a closed food day, with 001's own id seed (`diet:<date>:dayclosed`), so
 *     it is the same event 001 or the live writer would have made;
 *   · a weigh-in on a date with no weigh-in event, with the live writer's
 *     date seed (`body:live:<date>`).
 * Forward-only and additive: it never deletes, never rewrites an event that is
 * there, and re-running it adds nothing. After it, the live writers keep the
 * timeline current.
 */
import type { DietHistoryEntry } from "@/models/diet";
import type { BodyLogEntry } from "@/models/workout";

import { LEGACY } from "../storage/keys";
import type { HealthEvent } from "../../timeline/events";
import { TimelineRepository } from "../../timeline/TimelineRepository";
import { bodyEvent, dayClosedEvent, liveBodySeed } from "../../timeline/writers";
import type { Migration, MigrationReport } from "./runner";

export const migration005: Migration = {
  version: 5,
  name: "catch-up-learning-days",

  async up({ store }): Promise<MigrationReport> {
    const repo = new TimelineRepository(store);
    const [diet, body, existing] = await Promise.all([
      store.get<DietHistoryEntry[]>(LEGACY.DIET_HISTORY, []),
      store.get<BodyLogEntry[]>(LEGACY.BODY_LOGS, []),
      repo.query({ types: ["nutrition.day.closed", "body.measurement.logged"], includeSuperseded: true }),
    ]);

    const closedDates = new Set(
      existing.filter((e) => e.type === "nutrition.day.closed").map((e) => e.localDate),
    );
    const weighedDates = new Set(
      existing.filter((e) => e.type === "body.measurement.logged").map((e) => e.localDate),
    );

    const events: HealthEvent[] = [];
    let days = 0;
    let weighIns = 0;
    for (const d of Array.isArray(diet) ? diet : []) {
      if (!d?.date || closedDates.has(d.date)) continue;
      closedDates.add(d.date);
      events.push(dayClosedEvent(d, "import"));
      days++;
    }
    for (const b of Array.isArray(body) ? body : []) {
      if (!b?.date || weighedDates.has(b.date)) continue;
      if (!(typeof b.weightKg === "number" || typeof b.waistCm === "number")) continue;
      weighedDates.add(b.date);
      events.push(bodyEvent(b, liveBodySeed(b.date), "import"));
      weighIns++;
    }

    await repo.appendMany(events);
    return { daysAdded: days, weighInsAdded: weighIns };
  },
};
