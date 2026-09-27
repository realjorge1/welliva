/**
 * log_food — consent has to be to the thing that gets written.
 *
 * Found by the 2026-09-27 audit, in three rounds:
 *   1. The sheet quoted the model's words ("Log 1 × jollof rice?") while the
 *      write took the catalog's first search hit — which could be another food.
 *   2. Servings were rounded AFTER the user approved, so "Log 0.5 × avocado?"
 *      answered yes logged a whole one.
 *   3. It wrote to the meal PLAN as a whole-serving snack, not the food log the
 *      Foods screen uses — no half portions, no meal, no measured panel, and a
 *      failure whenever no plan was scheduled.
 * So the tool settles the amount first, has the host resolve AND measure the
 * food at that amount, shows exactly that line, and writes exactly that line.
 */

import { describe, expect, it, vi } from "vitest";
import {
  findTool,
  type FoodLogPreview,
  type GozlinToolContext,
  type MealSlot,
  type ToolConfirmRequest,
} from "../tools";

/** A host that measures like the food log: 240 kcal and 3 g protein per portion. */
function preview(portions: number): FoodLogPreview {
  return {
    id: "avocado",
    name: "Avocado",
    label: `${portions} medium Avocado`,
    quantity: portions,
    unit: "medium",
    calories: 240 * portions,
    proteinG: 3 * portions,
  };
}

function harness(opts: { found?: boolean; approve?: boolean; withResolve?: boolean } = {}) {
  const { found = true, approve = true, withResolve = true } = opts;
  const asked: ToolConfirmRequest[] = [];
  const resolveFood = vi.fn(async (name: string, portions: number) =>
    found
      ? { ok: true as const, food: preview(portions) }
      : { ok: false as const, reason: `No "${name}" in the food catalog.` },
  );
  const logFood = vi.fn(async (food: FoodLogPreview, _meal: MealSlot) => ({
    ok: true as const,
    label: food.label,
    calories: food.calories,
    proteinG: food.proteinG,
  }));
  const confirm = vi.fn(async (req: ToolConfirmRequest) => {
    asked.push(req);
    return approve;
  });
  const ctx = {
    actions: { ...(withResolve ? { resolveFood } : {}), logFood, confirm },
  } as unknown as GozlinToolContext;
  const run = (input: { food: string; servings: number; meal: MealSlot }) =>
    findTool("log_food")!.run(input, ctx) as Promise<Record<string, unknown>>;
  return { run, asked, resolveFood, logFood, confirm };
}

describe("log_food", () => {
  it("asks about the exact entry the food log will hold, with its figures", async () => {
    const h = harness();
    await h.run({ food: "avo", servings: 2, meal: "lunch" });
    expect(h.resolveFood).toHaveBeenCalledWith("avo", 2);
    expect(h.asked[0].summary).toBe("Log 2 medium Avocado to lunch?");
    expect(h.asked[0].detail).toBe("480 kcal · 6 g protein");
    expect(h.logFood).toHaveBeenCalledWith(preview(2), "lunch");
  });

  it("logs HALF a portion when half was said — and asks about half", async () => {
    const h = harness();
    const out = await h.run({ food: "avocado", servings: 0.5, meal: "snack" });
    expect(h.asked[0].summary).toBe("Log 0.5 medium Avocado as a snack?");
    expect(h.asked[0].detail).toBe("120 kcal · 2 g protein");
    expect(h.logFood).toHaveBeenCalledWith(preview(0.5), "snack");
    expect(out).toMatchObject({ status: "logged", logged: "0.5 medium Avocado", meal: "snack" });
    expect(out).not.toHaveProperty("requestedPortions");
  });

  it("settles an odd fraction to a quarter BEFORE asking, and says so", async () => {
    const h = harness();
    const out = await h.run({ food: "avocado", servings: 0.33, meal: "dinner" });
    expect(h.resolveFood).toHaveBeenCalledWith("avocado", 0.25);
    expect(h.asked[0].detail).toMatch(/You mentioned 0\.33\. Portions go in quarters, so this logs 0\.25\./);
    expect(out).toMatchObject({ requestedPortions: 0.33 });
  });

  it("caps an implausible amount and shows the cap", async () => {
    const h = harness();
    await h.run({ food: "avocado", servings: 40, meal: "snack" });
    expect(h.resolveFood).toHaveBeenCalledWith("avocado", 10);
    expect(h.asked[0].summary).toMatch(/^Log 10 medium Avocado/);
  });

  it("falls back to snack for a meal it doesn't recognise", async () => {
    const h = harness();
    await h.run({ food: "avocado", servings: 1, meal: "elevenses" as MealSlot });
    expect(h.logFood).toHaveBeenCalledWith(preview(1), "snack");
  });

  it("never asks about a food it could not find", async () => {
    const h = harness({ found: false });
    const out = await h.run({ food: "unobtainium", servings: 1, meal: "snack" });
    expect(out.status).toBe("not_found");
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.logFood).not.toHaveBeenCalled();
  });

  it("writes nothing when declined", async () => {
    const h = harness({ approve: false });
    const out = await h.run({ food: "avocado", servings: 1, meal: "snack" });
    expect(out.status).toBe("declined");
    expect(h.logFood).not.toHaveBeenCalled();
  });

  it("fails closed without a resolver — no sheet, no write", async () => {
    const h = harness({ withResolve: false });
    const out = await h.run({ food: "avocado", servings: 1, meal: "snack" });
    expect(out.status).toBe("unavailable");
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.logFood).not.toHaveBeenCalled();
  });
});
