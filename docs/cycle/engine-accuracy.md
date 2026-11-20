# How accurate is the cycle engine?

The cycle screen promises an "80% window": a range of days the next period
usually starts inside. This page records how often that is true, measured by a
**seeded population simulator** (`services/cycle/__tests__/simulate.ts`, scored
by `engineAccuracy.test.ts`), before and after the 2026-11-20 engine fixes
(`docs/prompts/05-cycle-engine-fixes.md`).

## How it is measured

- Six kinds of cycle, 30 simulated people each, 24 cycles per person, each
  cycle with a **known true ovulation** (second half of the cycle drawn from
  13 ± 1.5 days, the population figure from Bull et al. 2019).
- Everyone told the app "28 days" at setup, the commonest answer. So the
  archetypes whose real cycles are not 28 also show how fast that answer fades.
- On the first day of each period from the third on, the engine is asked when
  the next one will start, using only what she would have logged by then. Its
  answer is checked against what really happened.
- Seeded: the numbers only change when the engine does.

Columns:

- **In window**: share of forecasts whose real start fell inside the window
  (all forecasts / only those made with 8 or more cycles logged). The target is
  0.75 to 0.90. Higher means the window is wider than it needs to be.
- **Avg miss**: mean days between "most likely" and the real start, after 8
  cycles. Target: 1.5 days or less for the regular archetypes.
- **± days**: mean half-width of the window.
- **Fertile days**: mean length of the fertile-window estimate.
- **True ovulation inside**: share of cycles whose true ovulation fell inside
  the fertile-window estimate.

## Before (engine as of 2026-11-20, before the fixes)

| Archetype | Forecasts | In window (all) | In window (after 8) | Avg miss, days (after 8) | ± days | Fertile days | True ovulation inside |
|---|---|---|---|---|---|---|---|
| Regular 28 | 660 | 0.96 | 0.95 | 0.98 | 2.2 | 7.0 | 0.60 |
| Regular 32 | 660 | 0.93 | 0.93 | 1.11 | 2.3 | 7.0 | 0.49 |
| Irregular 24–40 | 660 | 0.65 | 0.67 | 4.69 | 5.2 | 7.0 | 0.36 |
| Long, variable 36–44 (PCOS on profile) | 660 | 0.63 | 0.66 | 3.91 | 4.7 | 7.0 | 0.15 |
| Teen 21–45 (age 16) | 660 | 0.61 | 0.62 | 6.49 | 7.2 | 7.0 | 0.29 |
| Perimenopause (lengthening, age 47) | 660 | 0.64 | 0.59 | 5.03 | 5.0 | 7.0 | 0.25 |

What this says, in plain words:

- For **regular** cycles the "80% window" is right 93–95% of the time. It is
  wider than it needs to be.
- For **every irregular kind** it is right only 59–67% of the time, and the
  "most likely" day is off by 4 to 6.5 days.
- The fertile window is **always 7 days**, whatever the cycle does, and for
  irregular cycles it contains the true ovulation in only 15–36% of cycles.
- Told 28 with real cycles of 36–44, the forecast sat about 3 days short
  (the setup answer never faded).

## After (all eleven fixes, 2026-11-20)

| Archetype | Forecasts | In window (all) | In window (after 8) | Avg miss, days (after 8) | ± days | Fertile days | True ovulation inside |
|---|---|---|---|---|---|---|---|
| Regular 28 | 660 | 0.96 | 0.95 | 0.98 | 2.3 | 8.0 | 0.84 |
| Regular 32 | 660 | 0.93 | 0.93 | 1.12 | 2.4 | 8.1 | 0.75 |
| Irregular 24–40 | 660 | 0.72 | 0.75 | 4.68 | 6.8 | 12.9 | 0.67 |
| Long, variable 36–44 (PCOS on profile) | 660 | 0.90 | 0.89 | 2.37 | 4.7 | 12.3 | 0.86 |
| Teen 21–45 (age 16) | 660 | 0.71 | 0.73 | 6.89 | 9.5 | 16.1 | 0.62 |
| Perimenopause (lengthening, age 47) | 660 | 0.78 | 0.78 | 4.08 | 6.3 | 12.4 | 0.64 |

### Before → after, the two numbers that matter

| Archetype | Window landed (after 8 cycles) | True ovulation inside the fertile window |
|---|---|---|
| Regular 28 | 0.95 → 0.95 | 0.60 → 0.84 |
| Regular 32 | 0.93 → 0.93 | 0.49 → 0.75 |
| Irregular 24–40 | 0.67 → 0.75 | 0.36 → 0.67 |
| Long, variable 36–44 (PCOS) | 0.66 → 0.89 | 0.15 → 0.86 |
| Teen 21–45 | 0.62 → 0.73 | 0.29 → 0.62 |
| Perimenopause | 0.59 → 0.78 | 0.25 → 0.64 |

And the most likely day: PCOS-like 3.91 → 2.37 days off, perimenopause 5.03 → 4.08; regular unchanged (0.98, 1.12 — under the 1.5 target).

### Where a target wasn't met, and why

- **Regular cycles land 93–95%, above the 75–90% target.** The window is in whole days. For a cycle that varies by about a day, ±1 day lands about three times in four and ±2 days about nineteen in twenty; nothing lies between. The app keeps ±2, the cautious side. (An uneven window, such as 1 day before and 2 after, could get closer; not built.)
- **Teens (cycles spread evenly over 21–45 days) land 73%, under 75%.** It was 61%. With six past forecasts to learn from, the self-check can't fully widen a window that wide, and a window wider than ±14 days says nothing useful anyway.
- **The irregular group's most likely day is still off by about 4.7 days.** That's the nature of cycles that range 24–40; what changed is that the window now admits it.

### What moved the numbers

- The setup answer fading (PCOS-like: 0.66 → 0.92 on its own).
- The 13-day second half and the widening fertile window (true ovulation inside: every group).
- The window checking itself against her own past periods, with the principled z-ratio scale (the brief's linear formula moved the irregular group only 2 points).
- The window's cap going from ±10 to ±14 days, and counting the median's own wobble.
- Tried and NOT kept: correcting a steady lean by up to 2 days. It helped perimenopause (miss 4.08 → 3.91) but made irregular, PCOS-like and teen worse.
