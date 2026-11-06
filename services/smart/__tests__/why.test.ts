/**
 * Your reason — exact words, once a month, only on a wobbly moment.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { LongTermStore } from "../../../health-os/memory/LongTermStore";
import { clearGozlinMemory, loadIdentity, rememberMotivation } from "../../gozlin/GozlinMemoryStore";
import { runJustLapsed, whyDue, whyLead, whyMessage } from "../why";

const IDENTITY_KEY = "@gozlin_identity";
const TODAY = "2026-11-10";

beforeEach(async () => {
  await AsyncStorage.removeItem(IDENTITY_KEY);
});

describe("the words", () => {
  it("are kept exactly as typed, trimmed and nothing else", async () => {
    await rememberMotivation("   i wanna keep up w/ my kids!! \n", new Date(2026, 10, 3, 9));
    const id = await loadIdentity();
    expect(id.motivation).toBe("i wanna keep up w/ my kids!!");
    expect(id.motivationAt).toBeTruthy();
  });

  it("keep the day they were said until they change", async () => {
    await rememberMotivation("For my kids", new Date(2026, 10, 3, 9));
    const first = (await loadIdentity()).motivationAt;
    await rememberMotivation("For my kids ", new Date(2026, 11, 3, 9));
    expect((await loadIdentity()).motivationAt).toBe(first);
    await rememberMotivation("To feel strong", new Date(2026, 11, 3, 9));
    expect((await loadIdentity()).motivationAt).not.toBe(first);
  });

  it("are quoted untouched, with no full stop added inside the quote", () => {
    const at = new Date(2026, 10, 3, 9).toISOString();
    expect(whyMessage("I want to keep up with my kids", at)).toBe(
      "On 3 November you said: “I want to keep up with my kids”. Still true?",
    );
    expect(whyLead(undefined)).toBe("You said:");
  });

  it("go with Clear memory and with the row's ✕", async () => {
    await rememberMotivation("For my kids");
    await LongTermStore.clearMotivation();
    const cleared = await loadIdentity();
    expect(cleared.motivation).toBeUndefined();
    expect(cleared.motivationAt).toBeUndefined();

    await rememberMotivation("For my kids");
    await clearGozlinMemory();
    expect((await loadIdentity()).motivation).toBeUndefined();
  });
});

describe("runJustLapsed", () => {
  it("is the day after a run of three or more lapsed", () => {
    expect(runJustLapsed(["2026-11-06", "2026-11-07", "2026-11-08"], [], TODAY)).toBe(true);
  });

  it("not after a shorter run, or a gap older than yesterday", () => {
    expect(runJustLapsed(["2026-11-07", "2026-11-08"], [], TODAY)).toBe(false);
    expect(runJustLapsed(["2026-11-05", "2026-11-06", "2026-11-07"], [], TODAY)).toBe(false);
  });

  it("not if today or yesterday was kept", () => {
    expect(runJustLapsed(["2026-11-06", "2026-11-07", "2026-11-08", TODAY], [], TODAY)).toBe(false);
    expect(runJustLapsed(["2026-11-07", "2026-11-08", "2026-11-09"], [], TODAY)).toBe(false);
  });

  it("not if yesterday was a paused rough day — that didn't lapse anything", () => {
    expect(runJustLapsed(["2026-11-06", "2026-11-07", "2026-11-08"], ["2026-11-09"], TODAY)).toBe(false);
  });

  it("counts a run across a paused day, without counting the day", () => {
    expect(runJustLapsed(["2026-11-05", "2026-11-07", "2026-11-08"], ["2026-11-06"], TODAY)).toBe(true);
    expect(runJustLapsed(["2026-11-07", "2026-11-08"], ["2026-11-06"], TODAY)).toBe(false);
  });
});

describe("whyDue", () => {
  const base = { motivation: "For my kids", wobbly: true, today: TODAY };

  it("needs words and a wobbly moment", () => {
    expect(whyDue({ ...base, quotedAt: undefined })).toBe(true);
    expect(whyDue({ ...base, motivation: undefined, quotedAt: undefined })).toBe(false);
    expect(whyDue({ ...base, motivation: "   ", quotedAt: undefined })).toBe(false);
    expect(whyDue({ ...base, wobbly: false, quotedAt: undefined })).toBe(false);
  });

  it("at most once every thirty days, answered or not", () => {
    expect(whyDue({ ...base, quotedAt: new Date(2026, 9, 15, 9).toISOString() })).toBe(false); // 26 days
    expect(whyDue({ ...base, quotedAt: new Date(2026, 9, 11, 9).toISOString() })).toBe(true); // 30 days
  });

  it("stays up for the rest of the day it first showed", () => {
    expect(whyDue({ ...base, quotedAt: new Date(2026, 10, 10, 8).toISOString() })).toBe(true);
  });
});
