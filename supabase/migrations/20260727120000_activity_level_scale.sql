-- =====================================================
-- Welliva — 0007 activity scale: four tiers → five
-- =====================================================
-- The app shipped four activity tiers, with `very_active` = 1.725. The standard
-- Mifflin-St Jeor scale has five; the missing top tier ("extra active": a
-- physical job AND daily training, 1.9) under-prescribed the most engaged users
-- by ~10% of TDEE. models/user.ts now defines all five, which renames the 1.725
-- slot: it used to be `very_active`, it is now `active`.
--
-- The CHECK constraint already permitted all five values, so there is no schema
-- change here — only a DATA remap. Every stored `very_active` predates the new
-- scale and means 1.725, so it must become `active` or those users would
-- silently jump to 1.9 (250-350 kcal/day) with nothing explaining it.
--
-- Mirrors health-os/platform/migrations/003-activity-level-scale.ts, which does
-- the same remap in on-device storage. Both are needed: the device migration
-- fixes users who open the app, this one fixes rows belonging to users who
-- haven't yet (and stops a stale remote value syncing back down as 1.9).
--
-- `activity_level` is stored TWICE — the typed column and the `bio` JSONB blob
-- that the app actually reads back. Both are remapped below.
--
-- ⚠️ RUN-ONCE, AND ORDER MATTERS.
--    Apply this BEFORE the five-tier client build reaches users. Afterwards,
--    `very_active` legitimately means 1.9 and remapping it would silently demote
--    a user who deliberately chose the top tier. The guard below makes a repeat
--    run a no-op by recording that it has already applied; do not remove it.
-- =====================================================

-- One-time guard. The Supabase CLI already tracks applied migrations, but this
-- file mutates user data, so it defends itself against a manual re-run too.
CREATE TABLE IF NOT EXISTS public.schema_data_migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.schema_data_migrations
        WHERE name = '20260727120000_activity_level_scale'
    ) THEN
        RAISE NOTICE 'activity scale remap already applied — skipping';
        RETURN;
    END IF;

    -- 1. The typed column.
    UPDATE public.users
       SET activity_level = 'active'
     WHERE activity_level = 'very_active';

    -- 2. The JSONB blob the app reads back on another device. jsonb_set only
    --    touches rows that actually carry the old value, so untouched profiles
    --    keep byte-identical blobs.
    UPDATE public.users
       SET bio = jsonb_set(bio, '{activityLevel}', '"active"', false)
     WHERE bio ? 'activityLevel'
       AND bio ->> 'activityLevel' = 'very_active';

    INSERT INTO public.schema_data_migrations (name)
    VALUES ('20260727120000_activity_level_scale');
END $$;

-- The constraint already allowed all five values, so app and DB are now exactly
-- aligned. Restated explicitly so the intended domain is visible in one place
-- and a future edit can't narrow it without noticing this file.
DO $$
BEGIN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_activity_level_check;
    ALTER TABLE public.users
        ADD CONSTRAINT users_activity_level_check
        CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Row-level security is unchanged: this table is service-role only.
ALTER TABLE public.schema_data_migrations ENABLE ROW LEVEL SECURITY;
