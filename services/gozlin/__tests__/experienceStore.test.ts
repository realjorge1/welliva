import { beforeEach, describe, expect, it } from "vitest";
import { readJSON } from "../../OfflineStorage";
import { activeCareFlags, foodFollowupsBlocked } from "../careFlags";
import {
  EXPERIENCE_KEYS,
  QUOTE_MAX,
  clipQuote,
  forgetAllExperiences,
  forgetExperience,
  loadCareFlags,
  loadCuriosityLog,
  loadExperiences,
  recordCareFlag,
  saveExperience,
  subscribeExperiences,
  upsertCuriosity,
} from "../ExperienceStore";
import { clearGozlinMemory } from "../GozlinMemoryStore";
import type { CuriosityEntry, ExperienceRecord } from "../novelty/types";

const NOW = new Date("2026-09-27T09:00:00Z");

function rec(id: string, over: Partial<ExperienceRecord> = {}): ExperienceRecord {
  return {
    id,
    kind: "exercise",
    variantKey: "hinge_09",
    familyKey: "nordic-curl",
    label: "Nordic Hamstring Curl",
    triedOn: "2026-09-26",
    answeredAt: NOW.toISOString(),
    source: "asked-chip",
    quote: "hamstrings wrecked",
    soreness: 3,
    enjoyed: null,
    feelings: ["Proud"],
    updatedAt: NOW.toISOString(),
    ...over,
  };
}

beforeEach(async () => {
  await clearGozlinMemory();
});

describe("forgetting", () => {
  it("scrubs every word but keeps a tombstone, so sync cannot merge it back", async () => {
    await saveExperience(rec("a"), NOW);
    await saveExperience(rec("b", { quote: "fine" }), NOW);
    const later = new Date(NOW.getTime() + 60_000);
    await forgetExperience("a", later);

    expect((await loadExperiences()).map((r) => r.id)).toEqual(["b"]);
    const raw = await readJSON<ExperienceRecord[]>(EXPERIENCE_KEYS.EXPERIENCES, []);
    const stone = raw.find((r) => r.id === "a")!;
    expect(stone.forgotten).toBe(true);
    expect(JSON.stringify(stone)).not.toContain("hamstrings");
    expect(JSON.stringify(stone)).not.toContain("Nordic");
    expect(stone.updatedAt).toBe(later.toISOString());
  });

  it("forgets all of them at once", async () => {
    await saveExperience(rec("a"), NOW);
    await saveExperience(rec("b"), NOW);
    await forgetAllExperiences(NOW);
    expect(await loadExperiences()).toEqual([]);
  });

  it("'Clear memory' takes the notes, the questions and the care flags with it", async () => {
    await saveExperience(rec("a"), NOW);
    await upsertCuriosity({ id: "cq", openedAt: NOW.toISOString() } as CuriosityEntry, NOW);
    await recordCareFlag("disordered_eating", NOW);
    let heard = 0;
    const off = subscribeExperiences(() => heard++);
    await clearGozlinMemory();
    off();
    expect(await loadExperiences()).toEqual([]);
    expect(await loadCuriosityLog()).toEqual([]);
    expect(await loadCareFlags()).toEqual([]);
    expect(heard).toBe(1);
  });
});

describe("their words", () => {
  it("are kept verbatim up to the limit, and clipped to a verbatim prefix past it", () => {
    expect(clipQuote("  legs   wrecked  ")).toBe("legs wrecked");
    const long = "my hamstrings were absolutely wrecked ".repeat(8).trim();
    const clipped = clipQuote(long);
    expect(clipped.length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(clipped.endsWith("…")).toBe(true);
    expect(long.startsWith(clipped.slice(0, -1))).toBe(true);
  });
});

describe("care flags", () => {
  it("keeps the kind and the time — nothing else — once a day", async () => {
    await recordCareFlag("disordered_eating", NOW);
    await recordCareFlag("disordered_eating", new Date(NOW.getTime() + 3_600_000));
    const flags = await loadCareFlags();
    expect(flags).toHaveLength(1);
    expect(Object.keys(flags[0]).sort()).toEqual(["at", "kind"]);
  });

  it("blocks food follow-ups for 180 days, then lets go", () => {
    const flags = [{ kind: "disordered_eating" as const, at: NOW.toISOString() }];
    expect(foodFollowupsBlocked(flags, new Date(NOW.getTime() + 179 * 86_400_000))).toBe(true);
    expect(foodFollowupsBlocked(flags, new Date(NOW.getTime() + 181 * 86_400_000))).toBe(false);
    expect(activeCareFlags(flags, new Date(NOW.getTime() + 181 * 86_400_000))).toEqual([]);
  });
});
