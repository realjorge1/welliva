-- =====================================================
-- Welliva — 0006 Catalogs bucket (Phase D.4)
-- =====================================================
-- One PUBLIC bucket, `catalogs`, holding the app's static reference data as JSON:
--
--   diet_library.json      the generated clinical diet library (~1 MB)
--   food_dictionary.json   the whole-foods dictionary
--   manifest.json          per-catalog content hash → drives the device cache
--
-- WHY PUBLIC (unlike avatars / progress-photos, which are private). These files
-- are non-personal, identical for every user, and previously shipped inside the
-- app binary for anyone to read. There is nothing to protect: making the bucket
-- public lets the anon client download them with a single unauthenticated GET
-- (offline-first cache on device — see services/catalogs/CatalogLoader.ts).
--
-- WRITES are service-role only (the upload script bypasses RLS), so no anon
-- insert/update/delete policy is created. Idempotent: converges on re-run and
-- only touches the one policy name we own.
-- =====================================================

-- ---------- Bucket ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalogs', 'catalogs', TRUE, 5242880,          -- 5 MB
        ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------- Public read policy ----------
-- A public bucket is already world-readable via the public endpoint; this SELECT
-- policy also authorizes the storage API's `.download()` used by the anon client.
DROP POLICY IF EXISTS catalogs_public_read ON storage.objects;
CREATE POLICY catalogs_public_read ON storage.objects FOR SELECT
    USING (bucket_id = 'catalogs');
