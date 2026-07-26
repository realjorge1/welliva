# Onboarding UX Improvements

## Changes Made

### User Model Updates (`models/user.ts`)

#### Primary Goal

Expanded from 4 to **6 options**:

- `lose_weight` - Reduce body fat
- `build_muscle` - Gain lean mass
- `improve_fitness` - Better endurance & strength
- `increase_energy` - More daily energy
- `better_health` - Overall wellness
- `athletic_performance` - Competitive edge

#### Dietary Restrictions (renamed from Preferences)

Changed from `dietaryPreference` to `dietaryRestriction` with updated values:

- `none` - No restrictions
- `vegetarian`
- `vegan`
- `pescatarian`
- `halal`
- `kosher`
- `gluten_free`
- `dairy_free`

**Removed**: Old preference types like "omnivore", "keto", "low_carb", "mediterranean" (these are now diet plans, not restrictions)

#### New Fields

- `exerciseLevel: "beginner" | "intermediate" | "advanced"` - User's fitness experience
- `injuries?: string[]` - Current injuries to consider in workout planning
- `medications?: string[]` - Current medications for safety considerations

### Onboarding Flow (`app/onboarding.tsx`)

Complete rebuild with improved 6-step flow:

#### Step 1: Basics

- Age (13-120)
- Biological sex (Male/Female)

#### Step 2: Body Measurements

- Height (cm)
- Weight (kg)

#### Step 3: Health Information

- Medical conditions (Hypertension, Diabetes Type 2, Renal issues, Pregnancy, Postpartum, None)
- Current injuries (optional text input)
- Current medications (optional text input)
- Food allergies (common allergies + custom input)

#### Step 4: Dietary Restrictions

- Select one dietary restriction or "No Restrictions"

#### Step 5: Exercise Experience

- Beginner - New to regular exercise
- Intermediate - Regular exerciser
- Advanced - Very experienced athlete

#### Step 6: Lifestyle & Goals

- Activity level (Sedentary, Light, Moderate, Very Active)
- **Primary goal** - 6 options displayed in a grid with icons and descriptions

### UX Improvements

1. **Better Organization** - Health info grouped together, goals come last
2. **Visual Hierarchy** - Icons, cards, and clear labels for all options
3. **Validation** - Step-by-step validation before proceeding
4. **Progress Bar** - Visual progress indicator showing "Step X of 6"
5. **Smooth Transitions** - Animated slide transitions between steps
6. **Mobile-Optimized** - Responsive cards, proper scrolling for long forms
7. **Fixed Completion Bug** - Proper async handling and navigation to main app

### Backend Updates

#### AppContext (`contexts/AppContext.tsx`)

- Updated `completeOnboarding()` to save new fields (exerciseLevel, dietaryRestriction, injuries, medications)
- Updated Supabase sync to use `dietary_restrictions` instead of `dietary_preferences`
- Updated goal mapping functions for 6 new goal types

#### DietMatchService (`services/DietMatchService.ts`)

- Renamed `PREFERENCE_COMPATIBLE_DIETS` → `RESTRICTION_COMPATIBLE_DIETS`
- Updated to handle new restriction types (halal, kosher, gluten_free, dairy_free)
- Updated `canAdaptDiet()` function to work with restrictions

#### NutritionService (`services/NutritionService.ts`)

- Updated `GOAL_CALORIE_MODIFIERS` with 6 new goal types:
  - `lose_weight`: -500 cal deficit
  - `build_muscle`: +300 cal surplus
  - `improve_fitness`: 0 (maintain)
  - `increase_energy`: +100 cal surplus
  - `better_health`: 0 (maintain)
  - `athletic_performance`: +200 cal surplus
- Updated protein calculation to use `build_muscle` and `athletic_performance` for 1.6g/kg

## Migration Notes

### Breaking Changes

- `UserBio.dietaryPreference` → `UserBio.dietaryRestriction`
- `PrimaryGoal` values changed (old: `lose_fat`, `maintain`, `gain_muscle`, `healthy_lifestyle`)
- New required fields: `exerciseLevel`

### Database Schema Updates Needed

If using Supabase, update the `users` table:

```sql
-- Rename column
ALTER TABLE users RENAME COLUMN dietary_preferences TO dietary_restrictions;

-- Add new columns
ALTER TABLE users ADD COLUMN exercise_level TEXT;
ALTER TABLE users ADD COLUMN injuries TEXT[];
ALTER TABLE users ADD COLUMN medications TEXT[];

-- Update existing health_goals values
UPDATE users SET health_goals = ARRAY['lose-weight'] WHERE health_goals @> ARRAY['lose-weight'];
UPDATE users SET health_goals = ARRAY['build-muscle'] WHERE health_goals @> ARRAY['build-muscle', 'gain-weight'];
UPDATE users SET health_goals = ARRAY['better-health'] WHERE health_goals @> ARRAY['general-health', 'maintain-weight'];
```

### Local Storage

Existing users will need to re-complete onboarding as the stored bio structure has changed.

## Testing Checklist

- [ ] New user completes full onboarding flow
- [ ] All 6 steps validate correctly
- [ ] Primary goal selection works (all 6 options)
- [ ] Exercise level selection works
- [ ] Dietary restrictions selection works
- [ ] Health info (injuries, medications, allergies) saves correctly
- [ ] Completion button navigates to main app (/(tabs))
- [ ] Nutrition targets calculate correctly with new goals
- [ ] Diet matching works with dietary restrictions
- [ ] Existing users are prompted to update their profile
