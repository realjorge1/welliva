/**
 * CalendarSource.syncToLifeContext — what a real phone's calendar did to "What's ahead".
 *
 * Found on a phone on 2026-11-15: one public holiday ("Eid El-Fitr Holiday") was
 * carried by three calendars, so it arrived three times, each filed as the
 * person's own "vacation". These pin the fix end to end: one copy, filed as a
 * holiday, the extra copies already saved tidied away, every other holiday of
 * the year NOT flooding in, and a failed read never wiping anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeCal = { id: string; title: string };
type FakeEvent = {
  id: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
};

const C = vi.hoisted(() => ({
  calendars: [] as FakeCal[],
  events: [] as FakeEvent[],
}));

vi.mock("expo-calendar", () => ({
  EntityTypes: { EVENT: "event" },
  getCalendarPermissionsAsync: async () => ({ status: "granted" }),
  requestCalendarPermissionsAsync: async () => ({ status: "granted" }),
  getCalendarsAsync: async () => C.calendars,
  getEventsAsync: async () => C.events,
}));

import { CalendarSource } from "../signals/calendar/CalendarSource";
import { LifeContextRepository } from "../lifecontext/LifeContextRepository";
import { TimelineRepository } from "../timeline/TimelineRepository";
import { ConsentRepository } from "../privacy/ConsentRepository";
import { MemoryStore } from "./helpers/MemoryStore";

const NOW = new Date(2026, 10, 15, 12, 0, 0); // 15 Nov 2026, local

function allDay(id: string, calendarId: string, title: string, y: number, m: number, d: number): FakeEvent {
  return {
    id,
    calendarId,
    title,
    startDate: new Date(y, m, d).toISOString(),
    endDate: new Date(y, m, d + 1).toISOString(), // exclusive end, like the OS
    allDay: true,
  };
}

async function setup() {
  const store = new MemoryStore();
  const life = new LifeContextRepository(store, new TimelineRepository(store));
  const consent = new ConsentRepository(new MemoryStore());
  await consent.grant("calendar");
  return { life, source: new CalendarSource(life, consent) };
}

beforeEach(() => {
  C.calendars = [
    { id: "h-1", title: "Holidays in Nigeria" },
    { id: "en.ng#holiday@group.v.calendar.google.com", title: "Public holidays" },
    { id: "me", title: "Personal" },
  ];
  C.events = [
    allDay("e1", "h-1", "Eid El-Fitr Holiday", 2027, 2, 11),
    allDay("e2", "en.ng#holiday@group.v.calendar.google.com", "Eid El-Fitr Holiday", 2027, 2, 11),
    allDay("e3", "me", "Eid El-Fitr Holiday", 2027, 2, 11),
    allDay("e4", "h-1", "Christmas Eve", 2026, 11, 24), // an ordinary holiday-calendar day
    allDay("e5", "me", "Flight to Abuja", 2026, 11, 20),
  ];
});

describe("calendar → What's ahead", () => {
  it("files one copy of a holiday carried by three calendars, as a holiday", async () => {
    const { life, source } = await setup();
    await source.syncToLifeContext({ now: NOW });
    const active = await life.listActive(NOW);
    const eid = active.filter((e) => /eid/i.test(e.title));
    expect(eid).toHaveLength(1);
    expect(eid[0].kind).toBe("holiday");
    // Not every holiday of the year: "Christmas Eve" carries no rule's keyword.
    expect(active.some((e) => e.title === "Christmas Eve")).toBe(false);
    expect(active.find((e) => /Abuja/.test(e.title))?.kind).toBe("travel");
  });

  it("tidies copies and wrong labels an earlier sync already saved", async () => {
    const { life, source } = await setup();
    // What the old code saved: three "vacation" copies, plus a holiday-calendar day.
    for (const id of ["e1", "e2", "e3"]) {
      await life.add(
        { id: `cal:${id}`, kind: "vacation", title: "Eid El-Fitr Holiday", window: { start: "2027-03-11" }, source: "calendar", confidence: 0.7 },
        NOW,
      );
    }
    await life.add(
      { id: "cal:e4", kind: "holiday", title: "Christmas Eve", window: { start: "2026-12-24" }, source: "calendar", confidence: 0.7 },
      NOW,
    );
    // And something the person typed in — never touched.
    await life.add({ kind: "wedding", title: "Ada's wedding", window: { start: "2026-12-05" } }, NOW);

    await source.syncToLifeContext({ now: NOW });
    const active = await life.listActive(NOW);
    const eid = active.filter((e) => /eid/i.test(e.title));
    expect(eid.map((e) => [e.id, e.kind])).toEqual([["cal:e1", "holiday"]]);
    expect(active.some((e) => e.title === "Christmas Eve")).toBe(false);
    expect(active.some((e) => e.title === "Ada's wedding")).toBe(true);
  });

  it("an empty read (a failure, or nothing ahead) never wipes what is there", async () => {
    const { life, source } = await setup();
    await source.syncToLifeContext({ now: NOW });
    const before = (await life.listActive(NOW)).length;
    C.events = [];
    await source.syncToLifeContext({ now: NOW });
    expect((await life.listActive(NOW)).length).toBe(before);
  });
});
