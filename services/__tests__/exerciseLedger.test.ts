import { describe, expect, it } from "vitest";
import { ingestIntoLedger, loadExerciseLedger } from "../ExerciseLedger";
import { session, NORDIC, PUSHUP, SQUAT } from "../gozlin/novelty/__tests__/fixtures";

describe("the stored ledger", () => {
  it("keeps BOTH sessions when two saves race — the player and the summary screen", async () => {
    // Without the queue, each read-modify-write starts from the same empty
    // ledger and the second write drops the first session.
    await Promise.all([
      ingestIntoLedger([session(1, [PUSHUP], "race_a")]),
      ingestIntoLedger([session(2, [SQUAT, NORDIC], "race_b")]),
    ]);
    const ledger = await loadExerciseLedger();
    const runs = ledger.recentRuns.map((r) => r.id);
    expect(runs).toContain("race_a");
    expect(runs).toContain("race_b");
    expect(ledger.subjects.hinge_09).toBeDefined();
  });
});
