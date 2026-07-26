-- =====================================================
-- Welliva — 0004 Storage buckets + per-bucket RLS
-- =====================================================
-- Three buckets, all PRIVATE:
--
--   avatars         profile pictures        (users.avatar_url)
--   progress-photos body / progress photos  (highly sensitive)
--   gozlin-audio    voice notes to the coach
--
-- WHY PRIVATE, INCLUDING AVATARS. A "public" bucket is world-readable to anyone
-- who guesses the URL — no auth, no RLS, forever. That is the normal trade for a
-- social app, where avatars are shown to other people anyway. Welliva has no
-- social surface at all: the Consistency League races AI pacers, not humans, so
-- a user's avatar is only ever rendered back to that same user. There is nobody
-- else to show it to, so there is nothing to buy with the exposure.
--
-- Consequence for the app: `users.avatar_url` holds the storage PATH
-- ("<uid>/avatar.jpg"), not an https URL. Render it through a short-lived signed
-- URL (see services/sync/StorageSync.ts). Storing a signed URL in that column
-- would be a bug — they expire, so it would rot in the DB.
--
-- OWNERSHIP MODEL. Every object must be keyed under the owner's uid as the first
-- path segment: "<uid>/<whatever>.jpg". The policies below enforce that with
-- (storage.foldername(name))[1] = auth.uid()::text, so a user can neither read
-- nor write outside their own folder. Uploads that skip the uid prefix are
-- rejected by the INSERT policy.
--
-- Idempotent. Unlike migration 0002 this does NOT blanket-drop every policy on
-- the table: storage.objects is shared by all buckets (and by Supabase's own
-- internal policies), so we only drop the four names we ourselves create.
-- =====================================================

-- ---------- Buckets ----------
-- ON CONFLICT so re-running converges the limits/mime rules instead of erroring.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars', 'avatars', FALSE, 5242880,                      -- 5 MB
     ARRAY['image/jpeg','image/png','image/webp']),
    ('progress-photos', 'progress-photos', FALSE, 15728640,     -- 15 MB
     ARRAY['image/jpeg','image/png','image/webp','image/heic']),
    ('gozlin-audio', 'gozlin-audio', FALSE, 26214400,           -- 25 MB
     ARRAY['audio/mpeg','audio/mp4','audio/m4a','audio/aac','audio/wav','audio/webm'])
ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------- RLS must actually be ON ----------
-- Supabase enables RLS on storage.objects by default, but if it were ever off,
-- the policies below would be a silent no-op — every bucket world-open with no
-- error to notice. Assert it. Wrapped because on some projects storage.objects
-- is owned by a role we can't ALTER; there, the default already holds and the
-- notice tells you to confirm rather than failing the whole migration.
DO $$
BEGIN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'storage.objects: cannot ALTER (not owner). Supabase enables RLS by default — verify under Storage → Policies.';
END $$;

-- ---------- Per-bucket owner-scoped policies ----------
DO $$
DECLARE
    bucket   TEXT;
    buckets  TEXT[] := ARRAY['avatars','progress-photos','gozlin-audio'];
    -- "own" as an infix keeps these greppable alongside the table policies.
    ops      TEXT[] := ARRAY['select','insert','update','delete'];
    op       TEXT;
    pol      TEXT;
BEGIN
    FOREACH bucket IN ARRAY buckets LOOP
        -- Drop only OUR policy names, leaving Supabase's internals alone.
        FOREACH op IN ARRAY ops LOOP
            pol := format('%s_own_%s', replace(bucket, '-', '_'), op);
            EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol);
        END LOOP;

        -- SELECT / UPDATE / DELETE: the row must already be in the caller's folder.
        EXECUTE format($f$
            CREATE POLICY %I ON storage.objects FOR SELECT
            USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text);
        $f$, format('%s_own_select', replace(bucket, '-', '_')), bucket);

        -- INSERT: WITH CHECK is what actually forces the "<uid>/…" layout.
        EXECUTE format($f$
            CREATE POLICY %I ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text);
        $f$, format('%s_own_insert', replace(bucket, '-', '_')), bucket);

        -- UPDATE needs both: USING picks the row, WITH CHECK stops a rename that
        -- would move the object into someone else's folder.
        EXECUTE format($f$
            CREATE POLICY %I ON storage.objects FOR UPDATE
            USING      (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
            WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text);
        $f$, format('%s_own_update', replace(bucket, '-', '_')), bucket, bucket);

        EXECUTE format($f$
            CREATE POLICY %I ON storage.objects FOR DELETE
            USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text);
        $f$, format('%s_own_delete', replace(bucket, '-', '_')), bucket);
    END LOOP;
END $$;
