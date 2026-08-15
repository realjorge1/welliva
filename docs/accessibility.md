# Accessibility

Google Play's pre-launch report runs an automated accessibility scan, and a low
score both flags in the console and excludes real users. This is the plan for
getting to zero, and the mechanism that keeps us there.

## The guard

`welliva/has-accessible-name` ([`eslint-rules/index.js`](../eslint-rules/index.js))
flags any `Pressable` / `Touchable*` that has an `onPress` but no accessible
name. It runs over `app/`, `components/` and `fitness/`.

> **Why a local rule.** The obvious choice, `eslint-plugin-react-native-a11y`,
> still peers on ESLint ≤8 while this project is on ESLint 9 flat config.
> Installing it with `--legacy-peer-deps` buys a plugin that cannot load — a new
> failure mode in exchange for a rule we can express in ~40 lines.

It is a **warning**, so it counts against the `--max-warnings` ceiling in CI
without blocking work. Promote it to `error` once the count reaches zero.

## The ratchet

CI runs `eslint . --max-warnings=165`. The ceiling sits just above the current
count. **Lower it every sprint** — a flag day never happens; a ratchet always
does.

| Date | Total warnings | of which a11y | Ceiling |
| --- | --- | --- | --- |
| 2026-07-27 (rule introduced) | 160 | 129 → **108** | 165 |

## What's done

**The component library first — that's most of the win.** Most touchables route
through the design system, so a fix there covers every call site at once:

- [`Button`](../components/ui/Button.tsx) — `accessibilityRole="button"`, label
  derived from the existing `label` prop (free coverage everywhere), plus
  `accessibilityState` carrying `disabled` / `busy`. `busy` matters: a loading
  button swaps its text for a spinner and would otherwise go silent mid-action.
- [`Card`](../components/ui/Card.tsx) — a pressable card now names itself and
  groups its children, instead of reading as a stream of disconnected fragments.
- [`IconBadge`](../components/ui/IconBadge.tsx) and
  [`ThemedIcon`](../components/ui/ThemedIcon.tsx) — **hidden from assistive tech
  by default.** Icon fonts are `Text` to the platform, so an unlabelled glyph is
  announced as whatever private-use character it maps to: literal garbage in
  VoiceOver/TalkBack. Both take an opt-in `accessibilityLabel` for the rare glyph
  that carries meaning alone.

**Screens fully passed:** `app/(tabs)/diet.tsx` (was the worst offender at 12),
`app/settings.tsx` (9), `app/foods.tsx`, `app/diet/plan-menu.tsx` (partial),
`app/fitness/library.tsx` (partial).

## What's left

108 warnings across 47 files. Burn down in this order — highest count first,
since they cluster in screens with many raw touchables:

| Count | File |
| --- | --- |
| 8 | `app/habit/new.tsx` |
| 8 | `app/life.tsx` |
| 7 | `app/diet/plan-menu.tsx` |
| 5 | `app/memory-center.tsx` |
| 5 | `app/privacy.tsx` |
| 5 | `components/diet/PlanDurationPicker.tsx` |
| 4 | `app/diet/history.tsx` |
| 4 | `app/diet/log-food.tsx` |

Get the exact list any time with:

```bash
npx eslint . -f json | node scripts/a11y-report.js   # or just: npx eslint app/life.tsx
```

## Beyond labels — not covered by the linter

The rule catches missing names. It cannot catch these, and they need a manual
pass before launch:

1. **Touch targets ≥ 44×44pt.** The `hitSlop={10}` back buttons are borderline.
   Audit the icon-only buttons specifically.
2. **Contrast ≥ 4.5:1.** The `alpha(colors.text, 0.06)` backgrounds and
   `textTertiary` need checking **in both themes** — light mode is usually the
   one that fails.
3. **Dynamic Type.** Verify the app survives the largest system font setting.
   With a Skia/absolute-positioned HUD like `guided-session`, that is where it
   will break first.

## Test with the real thing

Automated checks catch missing labels. Only a screen reader catches an unusable
*order*. Before launch, turn on **TalkBack** (Android) and **VoiceOver** (iOS)
and complete one full flow end to end:

> sign in → log a meal → start a workout

If that flow is completable, the app is usable. If it isn't, no lint score
matters.
