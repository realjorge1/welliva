-- =====================================================
-- Welliva — 0003 profile blob columns
-- =====================================================
-- The app's UserBio / UserGoals are rich, fast-evolving objects (~25 fields:
-- region, cuisine, equipment, conditions, injuries, preferences…). The narrow
-- typed columns on `users` can't hold all of it, so we store the full objects
-- verbatim as JSONB. This mirrors how the app already persists them (a single
-- blob in AsyncStorage) and lets UserBio grow without a migration each time.
--
-- The typed columns (age, weight, gender, activity_level, allergies,
-- health_goals…) are still populated on push for future SQL/analytics — `bio`
-- is just the lossless round-trip store the app reads back on another device.
--
-- Idempotent.
-- =====================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio   JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goals JSONB;
