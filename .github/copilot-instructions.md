# Welliva AI Coding Instructions

## Project Overview

Welliva is a React Native (Expo) fitness & nutrition app with **Supabase** backend (PostgreSQL + Auth), and **Google Gemini AI** for meal plan generation. Target users include African/Nigerian audiences with culturally-adapted diet options.

## Architecture

### Provider Hierarchy (Critical Order)

The app uses nested React Context providers in `app/_layout.tsx`. Order matters:

```
SupabaseAuthProvider → CustomThemeProvider → AuthWrapper → ProfileInfoProvider → DietProvider → NutritionProvider → ...
```

### Data Flow Pattern

- **Primary storage**: Supabase PostgreSQL (all user data MUST be stored in Supabase)
- **Authentication**: Supabase Auth with Google and Apple OAuth
- **Frontend state**: React Context providers in `components/*Context.tsx`
- **AI generation**: `constants/GeminiService.ts` for meal/workout generation
- **Legacy**: `constants/StorageService.ts` uses SecureStore

### Key Integration Points

| Component         | Purpose                     | Key Files                                                           |
| ----------------- | --------------------------- | ------------------------------------------------------------------- |
| Supabase Backend  | PostgreSQL DB, Auth         | `lib/supabase.ts`, `lib/database.types.ts`, `supabase/migrations/` |
| Cloud sync        | Profile + file sync layer   | `services/sync/` (`ProfileSync`, `StorageSync`, `SyncTelemetry`)    |
| Supabase Auth     | User authentication (OAuth) | `components/SupabaseAuthProvider.tsx`, `components/AuthWrapper.tsx` |
| Gemini AI         | Meal plan generation        | `constants/GeminiService.ts`                                        |
| Context Providers | Client state management     | `components/*Context.tsx`                                           |

## Development Workflow

### Starting Development

```bash
npx expo start  # Runs Expo dev server
```

### Database Setup

The schema is owned by **versioned migrations**, not a pasted file. Never edit
tables by clicking in the dashboard. Full runbook: `supabase/README.md`.

```powershell
supabase link --project-ref aisapqelfijpmqbpibqo
supabase db push
supabase gen types typescript --linked > lib/database.types.ts
```

> `supabase/schema.sql` no longer exists — it was superseded by
> `supabase/migrations/` and archived to `supabase/_archive/`. Do not run it.

### Environment Variables

Required in `.env`:

- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Code Patterns

### Supabase Queries

Use the hooks from `hooks/useSupabase.ts`:

```typescript
// hooks/useSupabase.ts pattern
const { user } = useSupabaseAuth();
const { nutritionLogs, logMeal } = useNutritionLogs(user?.id || null);
```

### Context Hook Pattern

Each context exports a custom hook. Always check for undefined:

```typescript
const context = useContext(NutritionContext);
if (!context) throw new Error("Must be used within Provider");
```

### Database Schema

All tables use `user_id: uuid` with RLS policies for security:

```sql
-- Row Level Security pattern
CREATE POLICY "Users can only access own data" ON table_name
  FOR ALL USING (auth.uid() = user_id);
```

### Date Handling

Dates stored as `YYYY-MM-DD` strings for nutrition/water logs, timestamps as ISO strings for everything else.

### Error Handling Pattern

- Use `try/catch` with `console.error()` for all async operations
- Return sensible defaults on failure (empty arrays, null, fallback data)
- For user-facing errors, throw with descriptive messages

```typescript
// Example from GeminiService.ts
} catch (error) {
  console.error("Error generating meal recommendations:", error);
  return this.getFallbackRecommendations(mealType); // Graceful fallback
}
```

### Logging Conventions

- Use `console.log()` for debug info (migration status, etc.)
- Use `console.error()` for caught exceptions with context
- Avoid logging sensitive data (API keys, user credentials)

## Security Notes

### API Key Management

- **Gemini API keys**: Currently stored client-side via AsyncStorage/localStorage in `GeminiService.ts`
- **Recommended**: Move API key storage to `expo-secure-store` (see `StorageService.ts` pattern)
- **Never** commit API keys to version control - use environment variables
- User-provided API keys should use SecureStore, not AsyncStorage

### Authentication Flow

- Supabase handles auth tokens via `expo-secure-store` in `lib/supabase.ts`
- User ID from Supabase Auth (`user.id`) is used as `user_id` in all tables
- Row Level Security (RLS) enforces data isolation

## File Conventions

### Screen Files (`app/`)

- Use Expo Router file-based routing
- Tab screens in `app/(tabs)/` are rendered via `CustomBottomNav`, NOT native tabs
- Dynamic routes: `app/exercise/[id].tsx`

### Adding New Features

1. **Schema**: `supabase migration new <name>`, write idempotent SQL, `supabase db push`
2. **Types**: regenerate — `supabase gen types typescript --linked > lib/database.types.ts`
3. **Sync**: add a slice under `services/sync/` (fail-soft, wrapped in
   `withSyncTelemetry`) — do NOT call `supabase.from()` from screens or services
4. **Context** (if needed): Create `components/NewFeatureContext.tsx`
5. **UI**: Create components in `components/`, screens in `app/`

> There is no `hooks/useSupabase.ts` — the only cloud access path is
> `services/sync/`.

### Storage Rules

- **All persistent data** → Supabase PostgreSQL
- **Sensitive credentials** → `expo-secure-store` only
- **Avoid** AsyncStorage for new features (legacy only)

### Diet Database

`constants/DietDatabase.ts` contains clinically-adapted diet data with Nigerian cuisine options. Each diet has:

- Meal options with calorie/macro ranges
- Clinical safety info (`safeFor`, `cautionFor`)
- Cultural adaptations (`isNigerian`, `cuisine` fields)

## Singleton Services

Services using singleton pattern - access via `getInstance()`:

- `GeminiService.getInstance()` - AI meal generation
- `StorageService.getInstance()` - Secure local storage (legacy)
