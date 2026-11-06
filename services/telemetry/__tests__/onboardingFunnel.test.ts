/**
 * DRIFT GUARD: the funnel's step names vs the flow's actual step machine.
 *
 * Why this is worth a test rather than a comment. `ONBOARDING_STEPS` in
 * services/telemetry/events.ts has to name the same steps as the `Step` union in
 * app/onboarding.tsx, and nothing in the type system connects them — the flow
 * owns its union privately, inside a 1,800-line route. When someone reorders or
 * renames a step, the two drift silently and the damage is invisible in the worst
 * way: `analytics_onboarding_funnel` keeps returning rows, they just describe a
 * flow that no longer exists. A step the app never emits reads as 100% drop-off
 * forever, and a step the app emits but the type never declared is a row that was
 * dropped by sanitize() and will never appear at all.
 *
 * Both failures look like a product problem ("everyone abandons at `about`")
 * rather than a bookkeeping one, which is exactly the sort of wrong number that
 * gets acted on. So the drift is made loud here, at the cheapest moment.
 *
 * This reads the route as TEXT on purpose: importing app/onboarding.tsx would
 * pull React Native, expo-router and the whole component graph into a Node test
 * for the sake of one type that does not exist at runtime.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ONBOARDING_STEPS } from "../events";

const ROUTE = join(process.cwd(), "app", "onboarding.tsx");

/** Pull the members out of `type Step = | "a" | "b" …;` in the route source. */
function stepsDeclaredInRoute(): string[] {
  const src = readFileSync(ROUTE, "utf8");
  const match = src.match(/\btype Step\s*=\s*([\s\S]*?);/);
  if (!match) {
    throw new Error(
      `Could not find \`type Step =\` in ${ROUTE}. If the flow's step machine was ` +
        `renamed or moved, update this guard — do not delete it.`,
    );
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("onboarding funnel step names", () => {
  it("finds the step union in the route", () => {
    expect(stepsDeclaredInRoute().length).toBeGreaterThan(3);
  });

  it("matches app/onboarding.tsx exactly, in order", () => {
    // Order matters as documentation, not for correctness: the funnel view sorts
    // by reach. Keeping them in flow order means a human can read the drop-off
    // top to bottom.
    expect([...ONBOARDING_STEPS]).toEqual(stepsDeclaredInRoute());
  });

  it("declares no step the flow cannot emit", () => {
    const real = new Set(stepsDeclaredInRoute());
    const ghosts = ONBOARDING_STEPS.filter((s) => !real.has(s));
    expect(
      ghosts,
      `These steps exist in the analytics taxonomy but not in the flow, so they ` +
        `would read as 100% drop-off forever: ${ghosts.join(", ")}`,
    ).toEqual([]);
  });

  it("misses no step the flow can emit", () => {
    const declared = new Set<string>(ONBOARDING_STEPS);
    const missing = stepsDeclaredInRoute().filter((s) => !declared.has(s));
    expect(
      missing,
      `The flow can reach these steps but the taxonomy does not declare them, so ` +
        `sanitize() drops the event and they never appear in the funnel at all: ` +
        `${missing.join(", ")}`,
    ).toEqual([]);
  });
});
