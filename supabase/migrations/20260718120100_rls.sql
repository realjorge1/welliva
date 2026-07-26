-- =====================================================
-- Welliva — 0002 Row-Level Security
-- =====================================================
-- The anon key ships in the app bundle ON PURPOSE — it is only safe because of
-- the policies below. Every table is owner-scoped: a signed-in user can touch
-- only rows where they are the owner (auth.uid()). With RLS off, that public
-- key would expose every user's data, so this migration is not optional.
--
-- Idempotent AND self-cleaning: for each table it first drops EVERY existing
-- policy (including any left over from the old hand-pasted schema.sql, which
-- used different names), then creates exactly one canonical CRUD set. Re-running
-- always converges to the same clean state.
--
-- Note: "delete" in the app is a soft delete (UPDATE deleted_at = now()), which
-- the UPDATE policy authorizes. The DELETE policy is kept for genuine hard
-- deletes (e.g. account teardown).
-- =====================================================

DO $$
DECLARE
    rec        RECORD;
    tbl        TEXT;
    owner_col  TEXT;
    -- table -> owner column. `users` is keyed on id; everything else on user_id.
    tables     TEXT[] := ARRAY[
        'users','meal_plans','nutrition_logs','workouts','achievements',
        'custom_meals','water_logs','streaks','custom_diets','consumed_meals'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        owner_col := CASE WHEN tbl = 'users' THEN 'id' ELSE 'user_id' END;

        -- Enable RLS (safe to re-run).
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        -- Drop any/all existing policies on this table (clears stale names).
        FOR rec IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.policyname, tbl);
        END LOOP;

        -- Create the canonical owner-scoped CRUD set.
        EXECUTE format(
            'CREATE POLICY own_select ON public.%I FOR SELECT USING (auth.uid() = %I);',
            tbl, owner_col);
        EXECUTE format(
            'CREATE POLICY own_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() = %I);',
            tbl, owner_col);
        EXECUTE format(
            'CREATE POLICY own_update ON public.%I FOR UPDATE USING (auth.uid() = %I) WITH CHECK (auth.uid() = %I);',
            tbl, owner_col, owner_col);
        EXECUTE format(
            'CREATE POLICY own_delete ON public.%I FOR DELETE USING (auth.uid() = %I);',
            tbl, owner_col);
    END LOOP;
END $$;
