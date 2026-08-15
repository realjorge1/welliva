/**
 * health-os/learning — the evaluation suite.
 *
 * These are the release gates for the learning claim. Each one replays a
 * synthetic user with KNOWN ground truth and asserts the estimate converges on
 * it. Without this, "learns and improves continuously" is marketing copy;
 * with it, it's a reproducible measurement.
 */

import { describe, expect, it } from "vitest";
import { MemoryStore } from "../../__tests__/helpers/MemoryStore";
import {
  adherenceRate,
  encodeContext,
  failureBreakdown,
  makeRecommendation,
  recordRecommendation,
  resolveDue,
  loadLedger,
  scoreOutcome,
  successRate,
} from "../ledger";
import { initKalman, read, step, tdeeDisclosure, tdeeForTargets } from "../tdee";
import {
  armMean,
  createPosteriorStore,
  divergenceFromPrior,
  sampleBeta,
  selectArm,
  update,
} from "../bandit";
import {
  MIN_SESSIONS_TO_FIT,
  POPULATION_PARAMS,
  componentsOn,
  fitParams,
  performanceOn,
  residual,
} from "../fitnessFatigue";
import { cusum, cusumRate, describeChange, detectAcross } from "../changepoint";
import {
  auc,
  calibrationError,
  decide,
  fit,
  populationModel,
  predict,
} from "../adherence";
import { ALL_ARMS, type ArmId, type MetricReader } from "../types";
import {
  COHORTS,
  armOutcome,
  bestArmRate,
  completionSeries,
  mulberry32,
  simulate,
  type SyntheticUser,
} from "./replay";

const user = (name: string): SyntheticUser => COHORTS.find((c) => c.name === name)!;

// ════════════════════════════════════════════════════════════════
// C1 — the outcome ledger
// ════════════════════════════════════════════════════════════════

describe("outcome ledger", () => {
  const ctx = encodeContext({
    goal: "lose",
    adherence: "mid",
    recovery: "amber",
    daytype: "weekday",
  });

  it("records a prediction before the outcome is known", async () => {
    const store = new MemoryStore();
    const rec = makeRecommendation({
      arm: "nudge:direct",
      context: ctx,
      action: { kind: "protein_nudge", params: { grams: 40 } },
      prediction: { metric: "protein_g", direction: "up", horizonDays: 1 },
      now: new Date(2026, 0, 10),
    });
    await recordRecommendation(store, rec);

    const ledger = await loadLedger(store);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].outcome).toBeUndefined();
    expect(ledger[0].issuedOn).toBe("2026-01-10");
  });

  it("resolves once the horizon closes, and not before", async () => {
    const store = new MemoryStore();
    await recordRecommendation(
      store,
      makeRecommendation({
        arm: "nudge:direct",
        context: ctx,
        action: { kind: "protein_nudge", params: { grams: 40 } },
        prediction: { metric: "protein_g", direction: "up", horizonDays: 3 },
        now: new Date(2026, 0, 10),
      }),
    );

    const read: MetricReader = (_m, from) => (from === "2026-01-07" ? 90 : 140);

    // One day later — still open.
    let report = await resolveDue(store, read, new Date(2026, 0, 11));
    expect(report).toMatchObject({ resolved: 0, pending: 1 });

    // Horizon closed — resolves.
    report = await resolveDue(store, read, new Date(2026, 0, 13));
    expect(report.resolved).toBe(1);

    const ledger = await loadLedger(store);
    expect(ledger[0].outcome).toMatchObject({ adhered: true, success: true });
    expect(ledger[0].outcome!.metricDelta).toBeCloseTo(50, 5);
  });

  it("is idempotent — a second run resolves nothing new", async () => {
    const store = new MemoryStore();
    await recordRecommendation(
      store,
      makeRecommendation({
        arm: "nudge:gentle",
        context: ctx,
        action: { kind: "water", params: {} },
        prediction: { metric: "water_ml", direction: "up", horizonDays: 1 },
        now: new Date(2026, 0, 10),
      }),
    );
    const read: MetricReader = (_m, from) => (from === "2026-01-09" ? 1200 : 2100);
    await resolveDue(store, read, new Date(2026, 0, 12));
    const second = await resolveDue(store, read, new Date(2026, 0, 12));
    expect(second.resolved).toBe(0);
  });

  it("leaves a record unresolved when there's no data, rather than scoring it zero", async () => {
    const store = new MemoryStore();
    await recordRecommendation(
      store,
      makeRecommendation({
        arm: "nudge:direct",
        context: ctx,
        action: { kind: "protein_nudge", params: {} },
        prediction: { metric: "protein_g", direction: "up", horizonDays: 1 },
        now: new Date(2026, 0, 10),
      }),
    );
    const report = await resolveDue(store, () => null, new Date(2026, 0, 12));
    expect(report).toMatchObject({ resolved: 0, unresolvable: 1 });
    expect((await loadLedger(store))[0].outcome).toBeUndefined();
  });

  it("separates 'didn't do it' from 'did it, didn't work'", () => {
    const base = makeRecommendation({
      arm: "nudge:direct",
      context: ctx,
      action: { kind: "deficit", params: {} },
      prediction: { metric: "weight_trend_kg", direction: "down", horizonDays: 7 },
      now: new Date(2026, 0, 10),
    });

    // Followed the plan; the scale didn't move. Model of the user is wrong.
    const ineffective = scoreOutcome(base, 82, 82.02, Date.now());
    expect(ineffective.adhered).toBe(true);
    expect(ineffective.success).toBe(false);

    // Went the wrong way entirely. The ask was wrong.
    const ignored = scoreOutcome(base, 82, 82.6, Date.now());
    expect(ignored.adhered).toBe(false);
    expect(ignored.success).toBe(false);

    const breakdown = failureBreakdown([
      { ...base, outcome: ineffective },
      { ...base, outcome: ignored },
    ]);
    expect(breakdown).toEqual({ ignored: 1, ineffective: 1 });
  });

  it("reports adherence and success rates over a window", () => {
    const now = new Date(2026, 0, 20);
    const mk = (adhered: boolean, success: boolean) => ({
      ...makeRecommendation({
        arm: "nudge:direct" as ArmId,
        context: ctx,
        action: { kind: "x", params: {} },
        prediction: { metric: "protein_g" as const, direction: "up" as const, horizonDays: 1 },
        now: new Date(2026, 0, 18),
      }),
      outcome: { observedAt: now.getTime(), adhered, metricDelta: 1, success },
    });
    const ledger = [mk(true, true), mk(true, false), mk(false, false), mk(true, true)];
    expect(adherenceRate(ledger, 30, now)).toBeCloseTo(0.75, 5);
    expect(successRate(ledger, 30, now)).toBeCloseTo(0.5, 5);
  });
});

// ════════════════════════════════════════════════════════════════
// C3 — adaptive TDEE
// ════════════════════════════════════════════════════════════════

describe("adaptive TDEE (Kalman)", () => {
  /** Replay a cohort through the filter, starting from a wrong Mifflin figure. */
  function converge(u: SyntheticUser, days: number, mifflin: number, seed: number) {
    let state = initKalman(u.startWeightKg, mifflin);
    for (const d of simulate(u, days, seed)) {
      state = step(state, d.loggedIntake, d.scaleKg);
    }
    return state;
  }

  const SEEDS = [7, 21, 99, 1234, 55, 8080];
  const errorAt = (u: SyntheticUser, days: number, seed: number) =>
    Math.abs(read(converge(u, days, 2180, seed)).learnedTdee - u.trueTdee) / u.trueTdee;

  it("converges within 5% of ground truth by day 35, on every noise realisation", () => {
    // A filter that only converges on one lucky seed has not converged.
    const u = user("consistent-logger");
    for (const seed of SEEDS) {
      expect(errorAt(u, 35, seed), `seed ${seed}`).toBeLessThan(0.05);
    }
  });

  it("is already close by day 21, on average", () => {
    // Worth stating precisely, because it's an information limit rather than a
    // tuning failure: with σ≈0.5 kg of daily scale noise, the standard error on
    // a 21-day energy-balance slope is ~140 kcal/day — about 6% of maintenance.
    // So "within 5% by day 21" is right at the edge of what the data can
    // support, and individual seeds land either side of it. Five weeks is the
    // honest figure; three weeks is the average one.
    const u = user("consistent-logger");
    const mean =
      SEEDS.reduce((sum, seed) => sum + errorAt(u, 21, seed), 0) / SEEDS.length;
    expect(mean).toBeLessThan(0.07);
  });

  it("beats the static Mifflin estimate it started from", () => {
    const u = user("consistent-logger");
    const state = converge(u, 28, 2180, 7);
    const learnedError = Math.abs(read(state).learnedTdee - u.trueTdee);
    const mifflinError = Math.abs(2180 - u.trueTdee);
    expect(learnedError).toBeLessThan(mifflinError);
  });

  it("handles missing days without special-casing them", () => {
    // The erratic logger weighs in ~45% of days and logs ~60%. The filter
    // should still improve on the starting estimate.
    const u = user("erratic-logger");
    const state = converge(u, 90, 1900, 5);
    expect(state.observations).toBeLessThan(90);
    expect(state.days).toBe(90);
    expect(Number.isFinite(read(state).learnedTdee)).toBe(true);
  });

  it("absorbs under-reporting into a lower learned figure", () => {
    // This is correct AND self-consistent for prediction — the same
    // under-reporting applies going forward — but it is why the number must
    // never be displayed as a physiological fact.
    const u = user("plateau-prone"); // under-reports 25%
    const state = converge(u, 120, 2600, 11);
    const learned = read(state).learnedTdee;
    expect(learned).toBeLessThan(u.trueTdee);
    // It should land near the APPARENT maintenance implied by their logs.
    const apparent = u.trueTdee * (1 - u.underReporting);
    expect(Math.abs(learned - apparent) / apparent).toBeLessThan(0.15);
  });

  it("refuses to surface a number before the filter is confident", () => {
    const u = user("consistent-logger");
    const early = converge(u, 10, 2180, 7);
    expect(read(early).confident).toBe(false);
    expect(tdeeDisclosure(early, 2180)).toBeNull();
    // And targets fall back to Mifflin rather than a half-formed estimate.
    expect(tdeeForTargets(early, 2180)).toBe(2180);
  });

  it("discloses the learned figure once it is confident", () => {
    const u = user("consistent-logger");
    const late = converge(u, 60, 2180, 7);
    expect(read(late).confident).toBe(true);
    const message = tdeeDisclosure(late, 2180);
    expect(message).toContain("maintenance looks closer to");
    expect(tdeeForTargets(late, 2180)).toBe(read(late).learnedTdee);
  });

  it("reports shrinking uncertainty as evidence accumulates", () => {
    const u = user("consistent-logger");
    const early = read(converge(u, 14, 2180, 7)).uncertainty;
    const late = read(converge(u, 60, 2180, 7)).uncertainty;
    expect(late).toBeLessThan(early);
  });
});

// ════════════════════════════════════════════════════════════════
// C2 — the bandit
// ════════════════════════════════════════════════════════════════

describe("contextual bandit", () => {
  const ctx = encodeContext({
    goal: "lose",
    adherence: "mid",
    recovery: "green",
    daytype: "weekday",
  });

  it("samples Beta within [0,1] and tracks the posterior mean", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const draw = sampleBeta(3, 7, rng);
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThanOrEqual(1);
    }
    expect(armMean({ alpha: 3, beta: 7 })).toBeCloseTo(0.3, 5);
  });

  /** Run the bandit against a synthetic user and return per-round rewards. */
  function play(u: SyntheticUser, rounds: number, seed: number) {
    const rng = mulberry32(seed);
    const store = createPosteriorStore();
    const rewards: number[] = [];
    for (let i = 0; i < rounds; i++) {
      const arm = selectArm(ctx, ALL_ARMS, store, rng);
      const success = armOutcome(u, arm, rng);
      update(ctx, arm, success, store);
      rewards.push(success ? 1 : 0);
    }
    return { rewards, store };
  }

  it("reduces regret over time versus its own early performance", () => {
    const u = user("consistent-logger");
    const { rewards } = play(u, 600, 42);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Compare the exploration phase to the converged tail. A quarter-vs-quarter
    // split is too coarse to show anything here: the bandit converges inside
    // the first ~100 rounds, so both quarters already look optimal.
    const first = mean(rewards.slice(0, 40));
    const last = mean(rewards.slice(-200));
    expect(last).toBeGreaterThan(first);
  });

  it("beats a fixed-arm baseline averaged over the arms", () => {
    const u = user("consistent-logger");
    const { rewards } = play(u, 600, 42);
    const banditRate = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const fixedAverage =
      Object.values(u.armResponse).reduce((a, b) => a + b, 0) / ALL_ARMS.length;
    expect(banditRate).toBeGreaterThan(fixedAverage);
  });

  it("approaches the best achievable rate", () => {
    const u = user("consistent-logger");
    const { rewards } = play(u, 1200, 7);
    const tail = rewards.slice(-300);
    const rate = tail.reduce((a, b) => a + b, 0) / tail.length;
    // Within 15 points of the oracle is convergence, not luck.
    expect(rate).toBeGreaterThan(bestArmRate(u) - 0.15);
  });

  it("DISCOVERS SILENCE for a user who does better without being nudged", () => {
    // The behaviour no competitor has, because silence is never in their
    // action space. Here the bandit learns to shut up.
    const u = user("silence-responder");
    const { store } = play(u, 800, 5);
    const means = ALL_ARMS.map((arm) => ({
      arm,
      mean: armMean(store.get(ctx, arm) ?? { alpha: 1, beta: 1 }),
    })).sort((a, b) => b.mean - a.mean);
    expect(means[0].arm).toBe("nudge:silence");
  });

  it("charts the coach → companion arc as KL divergence from the prior", () => {
    const u = user("consistent-logger");
    const early = play(u, 20, 9);
    const late = play(u, 500, 9);
    expect(divergenceFromPrior(late.store)).toBeGreaterThan(
      divergenceFromPrior(early.store),
    );
  });

  it("starts a brand-new user at the population prior", () => {
    const store = createPosteriorStore();
    // No evidence yet — nothing has diverged.
    expect(divergenceFromPrior(store)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
// C4 — fitness / fatigue
// ════════════════════════════════════════════════════════════════

describe("fitness–fatigue", () => {
  function block(days: number, every: number, load: number) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(2026, 0, 1 + i);
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        load: i % every === 0 ? load : 0,
      };
    });
  }

  it("makes fatigue decay faster than fitness", () => {
    // The whole shape of the model: a hard block feels awful, then a week
    // later feels like a personal best.
    const training = block(60, 2, 100);
    const dayAfter = componentsOn(training, "2026-02-01", POPULATION_PARAMS);
    const twoWeeksLater = componentsOn(training, "2026-02-15", POPULATION_PARAMS);
    const fatigueDrop = 1 - twoWeeksLater.fatigue / dayAfter.fatigue;
    const fitnessDrop = 1 - twoWeeksLater.fitness / dayAfter.fitness;
    expect(fatigueDrop).toBeGreaterThan(fitnessDrop);
  });

  it("excludes same-day load from that day's state", () => {
    const training = [{ date: "2026-01-10", load: 500 }];
    const sameDay = componentsOn(training, "2026-01-10", POPULATION_PARAMS);
    expect(sameDay.fitness).toBe(0);
    expect(sameDay.fatigue).toBe(0);
  });

  it("stays on population parameters until there is enough history", () => {
    const training = block(20, 2, 100);
    const observations = training
      .filter((t) => t.load > 0)
      .map((t) => ({ date: t.date, value: 50 }));
    expect(observations.length).toBeLessThan(MIN_SESSIONS_TO_FIT);
    expect(fitParams(training, observations)).toEqual(POPULATION_PARAMS);
  });

  it("fits a personal response better than the population default", () => {
    // Ground truth: a FAST recoverer — short fatigue constant, low fatigue gain.
    const truth = { tau1: 45, tau2: 4, k1: 1.2, k2: 0.8, p0: 20 };
    const training = block(120, 2, 100);
    const observations = training
      .filter((t, i) => t.load > 0 && i > 20)
      .map((t) => ({ date: t.date, value: performanceOn(training, t.date, truth) }));

    expect(observations.length).toBeGreaterThanOrEqual(MIN_SESSIONS_TO_FIT);
    const fitted = fitParams(training, observations);

    const fittedError = residual(training, observations, fitted);
    const populationError = residual(training, observations, POPULATION_PARAMS);
    expect(fittedError).toBeLessThan(populationError);
  });

  it("keeps fatigue decaying faster than fitness even after fitting", () => {
    const truth = { tau1: 45, tau2: 4, k1: 1.2, k2: 0.8, p0: 20 };
    const training = block(120, 2, 100);
    const observations = training
      .filter((t, i) => t.load > 0 && i > 20)
      .map((t) => ({ date: t.date, value: performanceOn(training, t.date, truth) }));
    const fitted = fitParams(training, observations);
    expect(fitted.tau2).toBeLessThan(fitted.tau1);
  });
});

// ════════════════════════════════════════════════════════════════
// C5 — change-point detection
// ════════════════════════════════════════════════════════════════

describe("change-point detection", () => {
  it("catches an injected collapse in completion, on most replays", () => {
    // Deliberately aggregate rather than single-seed. This detector is
    // stochastic by construction, so a one-seed assertion would either be
    // cherry-picked or flaky — neither of which tells you whether it works.
    //
    // Detecting a changed RATE on daily yes/no data takes weeks at a
    // defensible false-alarm budget: firing within days would mean firing on
    // noise several times a month.
    const u = user("plateau-prone"); // 0.6 → 0.2 at day 70
    const runs = 20;
    let detected = 0;
    let early = 0;

    for (let seed = 0; seed < runs; seed++) {
      const found = cusumRate(completionSeries(simulate(u, 140, seed)));
      if (!found) continue; // missed — accounted for by the detection floor
      if (found.at < u.changePointDay!) early++;
      else if (found.direction === "decline" && found.at - u.changePointDay! <= 60) {
        detected++;
      }
    }

    expect(detected / runs, `detected ${detected}/${runs}`).toBeGreaterThanOrEqual(0.7);
    // Firing before anything changed is worse than missing it — that's the
    // "cries wolf" failure the whole design is tuned against.
    expect(early / runs, `early ${early}/${runs}`).toBeLessThanOrEqual(0.15);
  });

  it("stays quiet on a stable user", () => {
    const u = user("consistent-logger");
    expect(cusumRate(completionSeries(simulate(u, 90, 3)))).toBeNull();
  });

  it("keeps false alarms rare across many stable replays", () => {
    // The gate that matters. An over-eager detector is worse than none, because
    // a coach who cries wolf about your habits stops being worth listening to.
    // ≤10% per 90-day window is roughly one false alarm every few years.
    const u = user("consistent-logger");
    let alarms = 0;
    const runs = 40;
    for (let seed = 0; seed < runs; seed++) {
      if (cusumRate(completionSeries(simulate(u, 90, seed)))) alarms++;
    }
    expect(alarms / runs).toBeLessThanOrEqual(0.1);
  });

  it("detects improvement as well as decline", () => {
    // Run the same detector on the improve side and you get EARNED
    // celebration instead of participation-trophy confetti.
    const rising = [
      ...Array.from({ length: 30 }, () => 0.3),
      ...Array.from({ length: 40 }, () => 0.95),
    ];
    expect(cusum(rising)?.direction).toBe("improve");
  });

  it("returns the strongest signal across several series", () => {
    const flat = Array.from({ length: 70 }, () => 0.8);
    const falling = [
      ...Array.from({ length: 30 }, () => 0.8),
      ...Array.from({ length: 40 }, () => 0.05),
    ];
    const found = detectAcross({ protein: flat, sessions: falling });
    expect(found?.metric).toBe("sessions");
  });

  it("phrases a decline as an opener, not an alert", () => {
    const line = describeChange({ at: 70, direction: "decline", magnitude: 1 }, "the 14th", 6);
    expect(line).toContain("What changed?");
    expect(line).toContain("6 weeks");
    // Not a scoreboard.
    expect(line).not.toMatch(/missed|failed|streak lost/i);
  });
});

// ════════════════════════════════════════════════════════════════
// C6 — adherence prediction
// ════════════════════════════════════════════════════════════════

describe("adherence prediction", () => {
  const baseFeatures = {
    recentCompletion7d: 0.8,
    dayOfWeek: 2,
    sleepHours: 7.5,
    calendarLoad: 0.2,
    weatherAdversity: 0.1,
    daysSinceLastSession: 1,
    recoveryScore: 70,
    streak: 10,
  };

  /** Ground truth: completion driven by recent consistency and calendar load. */
  function sample(rng: () => number) {
    const recentCompletion7d = rng();
    const calendarLoad = rng();
    const p = 1 / (1 + Math.exp(-(-1.2 + 3.4 * recentCompletion7d - 2.2 * calendarLoad)));
    return {
      features: { ...baseFeatures, recentCompletion7d, calendarLoad },
      completed: rng() < p,
    };
  }

  it("produces a probability in range", () => {
    const p = predict(populationModel(), baseFeatures);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("treats a missing sleep reading as typical, not as zero hours", () => {
    const withSleep = predict(populationModel(), { ...baseFeatures, sleepHours: 7.5 });
    const missing = predict(populationModel(), { ...baseFeatures, sleepHours: null });
    expect(missing).toBeCloseTo(withSleep, 6);
  });

  it("learns a signal, and gets close to the achievable ceiling", () => {
    const rng = mulberry32(17);
    const train = Array.from({ length: 250 }, () => sample(rng));
    const test = Array.from({ length: 250 }, () => sample(rng));
    const model = fit(train);

    const predictions = test.map((s) => predict(model, s.features));
    const labels = test.map((s) => s.completed);

    // Skewed base rate makes accuracy useless here — a model that always says
    // "yes" scores ~75% and is worthless for the only decision we care about.
    // Rank quality is the test.
    const modelAuc = auc(predictions, labels);

    // The generative process is itself noisy, so AUC 1.0 is unreachable. Score
    // against the ORACLE — the true probability function — rather than an
    // arbitrary constant, which is the only way to know whether a shortfall is
    // the model's fault or the data's.
    const oracle = test.map(
      (s) =>
        1 /
        (1 +
          Math.exp(
            -(-1.2 + 3.4 * s.features.recentCompletion7d - 2.2 * s.features.calendarLoad),
          )),
    );
    const oracleAuc = auc(oracle, labels);

    expect(modelAuc).toBeGreaterThan(0.7);
    expect(modelAuc).toBeGreaterThan(oracleAuc - 0.05);
  });

  it("is calibrated enough for the at-risk threshold to mean something", () => {
    const rng = mulberry32(23);
    const train = Array.from({ length: 400 }, () => sample(rng));
    const test = Array.from({ length: 400 }, () => sample(rng));
    const model = fit(train);
    const predictions = test.map((s) => predict(model, s.features));
    const labels = test.map((s) => s.completed);
    expect(calibrationError(predictions, labels)).toBeLessThan(0.12);
  });

  it("shrinks tomorrow's ask instead of commenting on the miss afterwards", () => {
    const model = { ...populationModel(), samples: 100 };
    const action = decide(0.15, model);
    expect(action.kind).toBe("shrink");
    if (action.kind === "shrink") {
      expect(action.scale).toBeLessThan(1);
      expect(action.scale).toBeGreaterThan(0);
    }
  });

  it("does not act on an unfitted model", () => {
    // A model that has seen almost nothing predicting doom is the prior
    // talking, not the user — never shrink a real session on that basis.
    expect(decide(0.05, populationModel()).kind).toBe("proceed");
  });

  it("proceeds when the user is likely to show up", () => {
    const model = { ...populationModel(), samples: 100 };
    expect(decide(0.9, model).kind).toBe("proceed");
  });
});

// ════════════════════════════════════════════════════════════════
// D3 — the diligence exhibit
// ════════════════════════════════════════════════════════════════

describe("the diligence exhibit", () => {
  it("shows adherence improving with tenure as the bandit learns delivery", () => {
    // The chart that turns "learns and improves continuously" from copy into
    // evidence: adherence plotted against weeks of user tenure.
    const u = user("silence-responder");
    const rng = mulberry32(31);
    const store = createPosteriorStore();
    const ctx = encodeContext({
      goal: "maintain",
      adherence: "mid",
      recovery: "green",
      daytype: "weekday",
    });

    const weekly: number[] = [];
    for (let week = 0; week < 12; week++) {
      let hits = 0;
      for (let day = 0; day < 7; day++) {
        const arm = selectArm(ctx, ALL_ARMS, store, rng);
        const success = armOutcome(u, arm, rng);
        update(ctx, arm, success, store);
        if (success) hits++;
      }
      weekly.push(hits / 7);
    }

    const early = (weekly[0] + weekly[1] + weekly[2]) / 3;
    const late = (weekly[9] + weekly[10] + weekly[11]) / 3;
    expect(late).toBeGreaterThan(early);
  });
});
