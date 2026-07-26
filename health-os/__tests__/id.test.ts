import { describe, expect, it } from "vitest";

import { ulid, ulidFromSeed } from "../platform/id";

describe("id", () => {
  it("ulidFromSeed is deterministic — same seed yields the same id", () => {
    expect(ulidFromSeed("diet:2026-06-25:dayclosed", 1000)).toBe(
      ulidFromSeed("diet:2026-06-25:dayclosed", 1000),
    );
  });

  it("different seeds yield different ids", () => {
    expect(ulidFromSeed("a", 1000)).not.toBe(ulidFromSeed("b", 1000));
  });

  it("encodes time in the high-order chars so ids sort chronologically", () => {
    const earlier = ulid(1_000, () => 0);
    const later = ulid(2_000, () => 0);
    expect(earlier < later).toBe(true);
  });

  it("seeded ids stay time-sortable across the same seed", () => {
    expect(ulidFromSeed("x", 1_000) < ulidFromSeed("x", 2_000)).toBe(true);
  });

  it("produces 26-char ids", () => {
    expect(ulidFromSeed("anything", 1234).length).toBe(26);
  });
});
