import { describe, expect, it } from "vitest";
import { RECALL, askedInReply, recallFor, recallsUsed } from "../recall";
import { subjectFor, type ExerciseSubject } from "../subjects";
import type { ExperienceRecord } from "../types";
import { at, day } from "./fixtures";

function record(over: Partial<ExperienceRecord> = {}): ExperienceRecord {
  return {
    id: over.id ?? "x1",
    kind: "exercise",
    variantKey: "hinge_09",
    familyKey: "nordic-curl",
    label: "Nordic Hamstring Curl",
    triedOn: day(10),
    answeredAt: at(11, 8).toISOString(),
    source: "asked-chip",
    quote: "hamstrings were wrecked for two days",
    soreness: 3,
    enjoyed: "yes",
    feelings: [],
    updatedAt: at(11, 8).toISOString(),
    ...over,
  };
}

const planned = (id: string, name: string): ExerciseSubject =>
  subjectFor({ exerciseId: id, name, category: "legs", difficulty: "intermediate" });

const NOW = at(40, 9);
const input = (over: Partial<Parameters<typeof recallFor>[0]> = {}) => ({
  records: [record()],
  text: "what's on today?",
  planned: [] as ExerciseSubject[],
  logged: [] as ExerciseSubject[],
  now: NOW,
  ...over,
});

describe("recall — only when the subject comes back", () => {
  it("offers nothing when nothing about today touches it", () => {
    expect(recallFor(input({ planned: [planned("legs_01", "Bodyweight Squats")] }))).toEqual([]);
  });

  it("offers it when it is in today's plan, with the days since it was tried", () => {
    const [p] = recallFor(input({ planned: [planned("hinge_09", "Nordic Hamstring Curl")] }));
    expect(p).toMatchObject({ trigger: "planned", match: "variant", daysAgo: 30 });
  });

  it("offers it when they mention it themselves", () => {
    const [p] = recallFor(input({ text: "can I do nordic curls again this week?" }));
    expect(p.trigger).toBe("mentioned");
  });

  it("matches another variant of the family, and keeps the variant they did", () => {
    const archer = record({ variantKey: "push_08", familyKey: "push-up", label: "Archer Push-ups" });
    const [p] = recallFor(input({ records: [archer], planned: [planned("push_03", "Diamond Push-ups")] }));
    expect(p).toMatchObject({ match: "family" });
    expect(p.record.label).toBe("Archer Push-ups");
  });

  it(`rests a used memory for ${RECALL.restDays} days — unless they raise it`, () => {
    const used = record({ lastRecalledAt: at(35, 9).toISOString() });
    const plan = [planned("hinge_09", "Nordic Hamstring Curl")];
    expect(recallFor(input({ records: [used], planned: plan }))).toEqual([]);
    expect(recallFor(input({ records: [used], planned: plan, text: "nordic curls again?" }))).toHaveLength(1);
    expect(recallFor(input({ records: [used], planned: plan, now: at(57, 9) }))).toHaveLength(1);
  });

  it("does not call this morning's answer 'last time'", () => {
    const fresh = record({ answeredAt: at(40, 7).toISOString() });
    expect(recallFor(input({ records: [fresh], planned: [planned("hinge_09", "Nordic Hamstring Curl")] }))).toEqual([]);
  });

  it(`sends at most ${RECALL.max}, their own mention first`, () => {
    const many = [
      record({ id: "a", variantKey: "legs_07", familyKey: "single-leg-squat", label: "Pistol Squats" }),
      record({ id: "b", variantKey: "push_08", familyKey: "push-up", label: "Archer Push-ups" }),
      record({ id: "c", variantKey: "pull_06", familyKey: "pull-up", label: "Pull-ups" }),
      record({ id: "d" }),
    ];
    const picks = recallFor(
      input({
        records: many,
        text: "thinking about nordic curls",
        planned: [
          planned("legs_07", "Pistol Squats"),
          planned("push_08", "Archer Push-ups"),
          planned("pull_06", "Pull-ups"),
        ],
      }),
    );
    expect(picks).toHaveLength(RECALL.max);
    expect(picks[0].record.id).toBe("d");
  });

  it("skips a record with nothing in it", () => {
    const empty = record({ quote: null, soreness: null, enjoyed: null, feelings: [] });
    expect(recallFor(input({ records: [empty], text: "nordic curls?" }))).toEqual([]);
  });

  it("never recalls a forgotten one, even when they raise it", () => {
    const gone = record({ forgotten: true });
    expect(recallFor(input({ records: [gone], text: "nordic curls?" }))).toEqual([]);
  });
});

describe("reading the reply back", () => {
  const nordic = { label: "Nordic Hamstring Curl", familyKey: "nordic-curl" };

  it("knows when the reply asked about it — by any name a coach would use", () => {
    expect(askedInReply("Good work yesterday. How are the hamstrings after those Nordics?", nordic)).toBe(true);
    expect(askedInReply("How did the nordic curls sit with you?", nordic)).toBe(true);
  });

  it("does not count a mention that isn't a question, or a question about something else", () => {
    expect(askedInReply("The Nordics were a big step up.", nordic)).toBe(false);
    expect(askedInReply("Nordics went in. How did you sleep?", nordic)).toBe(false);
  });

  it("gives a receipt only to the memories the reply used", () => {
    const picks = recallFor(input({ text: "nordic curls again?" }));
    expect(recallsUsed("Last time the Nordics left you wrecked — go easy on set one.", picks)).toHaveLength(1);
    expect(recallsUsed("Sure, the plan has you on squats today.", picks)).toHaveLength(0);
  });
});
