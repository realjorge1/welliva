-- Per-user document mirror: the durable cloud copy of each AsyncStorage namespace.
--
-- The app's local state is ~50 heterogeneous AsyncStorage blobs (day-aggregates,
-- app-specific records, Gozlin's memory tiers, the health-os event store). Rather
-- than build a normalized table per shape, we mirror each key as one JSONB row.
-- The device stays the source of truth; this is the durable copy that lets a user
-- continue on any device. Same owner-scoped RLS + server-stamped updated_at
-- discipline as every other table.
CREATE TABLE IF NOT EXISTS public.sync_documents (
    user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doc_key    TEXT        NOT NULL,                 -- e.g. '@welliva_nutrition_history'
    doc        JSONB,                                -- the value; NULL when tombstoned
    device_id  TEXT,                                 -- last writer (debugging only)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- server-stamped by trigger
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, doc_key)
);

ALTER TABLE public.sync_documents ENABLE ROW LEVEL SECURITY;

-- Idempotent policy reset so re-running the migration never errors on a dup name.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='sync_documents'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.sync_documents;', r.policyname); END LOOP;
END $$;
CREATE POLICY own_select ON public.sync_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_insert ON public.sync_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_update ON public.sync_documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_delete ON public.sync_documents FOR DELETE USING (auth.uid() = user_id);

-- Server-stamp updated_at on every UPDATE so the device clock can't skew LWW ordering.
DROP TRIGGER IF EXISTS set_updated_at ON public.sync_documents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sync_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();  -- reuse existing fn

-- The delta-pull query: "every doc for this user changed since <watermark>".
CREATE INDEX IF NOT EXISTS idx_sync_documents_pull
  ON public.sync_documents(user_id, updated_at);
