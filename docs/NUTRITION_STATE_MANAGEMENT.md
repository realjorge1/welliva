# Nutrition State Management - Critical Rules

## Overview

This document defines the non-negotiable rules for meal consumption state persistence and nutrition progress tracking in the Welliva app.

## Core Principle: Planning vs Consumption

| Concept         | Description                             | Used For              |
| --------------- | --------------------------------------- | --------------------- |
| **Planning**    | Meals set/scheduled for the day         | Setting daily TARGETS |
| **Consumption** | Meals actually eaten/marked as consumed | PROGRESS calculation  |

**RULE: Progress bars ONLY reflect consumed meals, never planned meals.**

---

## State Persistence Rules

### Consumed Meals State

**Source of Truth**: `Convex consumedMeals table`

```typescript
// Schema
consumedMeals: {
  userId: string,
  date: string, // YYYY-MM-DD
  breakfast: boolean,
  lunch: boolean,
  dinner: boolean,
  snack: boolean,
  updatedAt: number
}
```

### Persistence Requirements

1. **Navigation events NEVER reset consumption state**
2. State is tied to DATE, not screen lifecycle
3. Consumed state persists across:
   - Tab switching
   - Screen navigation
   - App backgrounding
   - App restart

### Reset Conditions (ONLY)

Consumed meals may reset ONLY when:

1. A new calendar day begins (date changes)
2. Weekly diet advances to the next day's meals

---

## Progress Bar Semantics

### Daily Nutrient Progress

```
Progress = Consumed / Planned × 100%
```

| Metric                   | Source                     | Example  |
| ------------------------ | -------------------------- | -------- |
| **Target** (denominator) | Sum of all planned meals   | 900 kcal |
| **Progress** (numerator) | Sum of consumed meals only | 200 kcal |
| **Display**              | "200 / 900 kcal"           | 22% fill |

### Progress Bar Behavior

```
Setup Phase (adding meals to plan):
┌────────────────────────────────┐
│ Target: 0 → 200 → 700 → 900    │ (increases as meals added)
│ Progress: 0                     │ (stays at 0)
└────────────────────────────────┘

Consumption Phase (marking meals eaten):
┌────────────────────────────────┐
│ Target: 900 (fixed)            │
│ Progress: 0 → 200 → 700 → 900  │ (increases as meals eaten)
└────────────────────────────────┘
```

---

## Key Service Methods

### DateAwareNutritionService

```typescript
// Calculate PLANNED nutrition (for targets)
calculateNutritionFromSchedule(schedule): DerivedNutrition

// Calculate CONSUMED nutrition (for progress)
calculateConsumedNutrition(schedule, consumedStatus): DerivedNutrition

// Get complete state for UI
getNutritionProgressState(schedule, consumedStatus): NutritionProgressState
```

### Usage in Components

```typescript
// ❌ WRONG: Using planned for progress
const progress = (planned / target) * 100;

// ✅ CORRECT: Using consumed for progress
const progress = (consumed / planned) * 100;
```

---

## Screen-Specific Implementation

### Meals Screen (`meals.tsx`)

- **Progress bars**: Use `calculateConsumedNutrition()`
- **Consumed state**: Synced from `api.consumedMeals.getConsumedMealsByDate`
- **Mark as eaten**: Persists to Convex via `api.consumedMeals.markMealConsumed`

### Nutrition Screen (`nutrition.tsx`)

- Shows PLANNING progress (how well plan meets goal)
- Clearly labeled as "Meal Plan" vs "Daily Goal"

### Home Screen (`index.tsx`)

- Shows planned nutrition from current diet
- Uses `getNutritionDisplayState()` for display

### Profile History (`DietHistoryTimeline.tsx`)

- Shows CONSUMED data only
- Data from `api.consumedMeals.getConsumedMealsHistory`
- Never shows planned-but-uneaten meals

---

## Anti-Patterns to Avoid

### ❌ DO NOT

1. Initialize consumed state to false in useState without checking Convex first
2. Use planned totals for progress bar fill
3. Reset consumed state on screen mount
4. Store consumed state only in local component state
5. Show history data that includes uneaten planned meals

### ✅ DO

1. Always sync consumed state from Convex on mount
2. Use null initial state to indicate "loading"
3. Persist consumed state to Convex immediately when meal marked as eaten
4. Calculate progress from consumed meals only
5. Use `safeConsumedMeals` pattern for null-safe JSX access

---

## Code Patterns

### Null-Safe Consumed State Pattern

```typescript
// State with null for loading
const [consumedMeals, setConsumedMeals] = useState<ConsumedMeals | null>(null);

// Safe accessor for JSX
const safeConsumedMeals = consumedMeals || {
  breakfast: false,
  lunch: false,
  dinner: false,
  snack: false,
};

// Sync from Convex
useEffect(() => {
  if (consumedMealsFromConvex) {
    setConsumedMeals(consumedMealsFromConvex);
  } else if (consumedMealsFromConvex === undefined) {
    // Still loading - keep null
  } else {
    // No record exists - initialize empty
    setConsumedMeals({
      breakfast: false,
      lunch: false,
      dinner: false,
      snack: false,
    });
  }
}, [consumedMealsFromConvex]);
```

### Progress Calculation Pattern

```typescript
// Calculate consumed nutrition (returns 0 if state loading)
const calculateConsumedNutrition = () => {
  if (!consumedMeals) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  let total = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (consumedMeals.breakfast && plannedMeals.breakfast) {
    total.calories += plannedMeals.breakfast.calories;
    // ... other nutrients
  }
  // ... repeat for lunch, dinner, snack

  return total;
};

// Use in progress bar
const progress = plannedTarget > 0 ? (consumed / plannedTarget) * 100 : 0;
```

---

## Testing Checklist

Before releasing, verify:

- [ ] Marking meal as eaten persists after navigating away and back
- [ ] Progress bar shows 0% when no meals consumed (even if meals planned)
- [ ] Progress bar increases only when meal marked as eaten
- [ ] Consumed state survives app restart
- [ ] History view shows only actually consumed meals
- [ ] New day properly resets consumed state
- [ ] Progress bar never exceeds 100% (or handles overflow gracefully)

---

## Related Files

- `services/DateAwareNutritionService.ts` - Core nutrition state logic
- `components/CustomDietContext.tsx` - Diet and nutrition display state
- `components/MealPlanContext.tsx` - Meal planning state
- `app/(tabs)/meals.tsx` - Main consumption tracking UI
- `components/DietHistoryTimeline.tsx` - History display
- `convex/consumedMeals.ts` - Backend persistence

---

_Last updated: January 2026_
_Principle: When unsure, preserve data, preserve user trust, favor accuracy over animation._
