-- =====================================================
-- Welliva — 0001 init schema (sync-ready)
-- =====================================================
-- Provisions the full app schema and makes every table safe to sync across
-- devices. Supersedes the old supabase/schema.sql (now archived), PLUS the
-- two columns that make multi-device sync correct:
--   • updated_at  — server-stamped by a trigger (never the device clock),
--                   so last-write-wins is fair across phones.
--   • deleted_at  — soft-delete tombstone, so a delete on phone A propagates
--                   to phone B instead of the row silently resurrecting.
--
-- This migration is IDEMPOTENT: it converges whether the live DB is empty or
-- already had the old schema pasted in (tables use IF NOT EXISTS; missing sync
-- columns are back-filled with ADD COLUMN IF NOT EXISTS).
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    age INTEGER,
    weight NUMERIC(5,2),
    height NUMERIC(5,2),
    gender TEXT CHECK (gender IN ('male', 'female')),
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    dietary_preferences TEXT[] DEFAULT '{}',
    health_goals TEXT[] DEFAULT '{}',
    allergies TEXT[] DEFAULT '{}',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    diet_type TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_calories INTEGER NOT NULL,
    target_protein INTEGER NOT NULL,
    target_carbs INTEGER NOT NULL,
    target_fats INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    next_update_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    meal_id UUID,
    meal_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein NUMERIC(6,2) NOT NULL,
    carbs NUMERIC(6,2) NOT NULL,
    fats NUMERIC(6,2) NOT NULL,
    water INTEGER,
    is_custom_meal BOOLEAN NOT NULL DEFAULT false,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_duration INTEGER NOT NULL DEFAULT 0,
    total_calories_burned INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    scheduled_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('nutrition', 'fitness', 'streak', 'milestone')),
    icon TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    progress INTEGER,
    target INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.custom_meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    calories INTEGER NOT NULL,
    protein NUMERIC(6,2) NOT NULL,
    carbs NUMERIC(6,2) NOT NULL,
    fats NUMERIC(6,2) NOT NULL,
    ingredients TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.water_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount INTEGER NOT NULL,
    target INTEGER NOT NULL DEFAULT 2000,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('meal_logging', 'workout', 'water')),
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, type)
);

CREATE TABLE IF NOT EXISTS public.custom_diets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT true,
    recommended_diet_type TEXT,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly')),
    daily_schedule JSONB,
    weekly_schedule JSONB,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.consumed_meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    breakfast BOOLEAN NOT NULL DEFAULT false,
    lunch BOOLEAN NOT NULL DEFAULT false,
    dinner BOOLEAN NOT NULL DEFAULT false,
    snack BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, date)
);

-- =====================================================
-- BACK-FILL sync columns on a pre-existing (old-schema) DB.
-- No-ops on a freshly created DB where the columns already exist.
-- =====================================================
ALTER TABLE public.nutrition_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.achievements   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.water_logs     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.users          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.meal_plans     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.nutrition_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.workouts       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.achievements   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.custom_meals   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.water_logs     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.streaks        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.custom_diets   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.consumed_meals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Server-side updated_at stamp. Runs BEFORE UPDATE so the client can never
-- forge the timestamp used for conflict resolution.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create the profile row when an auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger on every synced table. Drops both the canonical name and
-- the legacy per-table names from the old schema, so exactly one remains.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users','meal_plans','nutrition_logs','workouts','achievements',
        'custom_meals','water_logs','streaks','custom_diets','consumed_meals'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;', t, t);
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();', t);
    END LOOP;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================

-- Lookup indexes.
CREATE INDEX IF NOT EXISTS idx_users_email          ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id    ON public.meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active      ON public.meal_plans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date ON public.nutrition_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id      ON public.workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled     ON public.workouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id   ON public.achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_meals_user_id   ON public.custom_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date   ON public.water_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_streaks_user_id        ON public.streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_diets_user_id   ON public.custom_diets(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_diets_active    ON public.custom_diets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_consumed_meals_user_date ON public.consumed_meals(user_id, date);

-- Delta-pull indexes: "give me everything of mine changed since T" (the core
-- sync query). Covers tombstones too, since deleting bumps updated_at.
CREATE INDEX IF NOT EXISTS idx_meal_plans_sync     ON public.meal_plans(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_sync ON public.nutrition_logs(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_workouts_sync       ON public.workouts(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_achievements_sync   ON public.achievements(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_custom_meals_sync   ON public.custom_meals(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_water_logs_sync     ON public.water_logs(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_streaks_sync        ON public.streaks(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_custom_diets_sync   ON public.custom_diets(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_consumed_meals_sync ON public.consumed_meals(user_id, updated_at);
