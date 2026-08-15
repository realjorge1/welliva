-- =====================================================
-- Welliva — 0007 Account deletion (right to erasure)
-- =====================================================
-- Backs the promise made in constants/legal.ts:
--   privacy §"How long we keep it"  — "When you delete your account we remove
--                                      your profile, logs and files"
--   terms   §"Ending the agreement" — "delete your account and data from Settings"
--
-- Also the App Store 5.1.1(v) / Google Play requirement that any app offering
-- account creation offers in-app account DELETION, not just sign-out.
--
-- WHY AN RPC AND NOT CLIENT DELETES. A client holding the anon key can only do
-- what RLS allows, and RLS deliberately cannot reach `auth.users` — so a client
-- loop could clear every public table and still leave a live login behind: the
-- account would "delete" but the user could sign back in to an empty shell.
-- One SECURITY DEFINER function removes the auth row instead, and the FK graph
-- does the rest.
--
-- THE CASCADE (why this function is 4 lines and not 40). From migration 0001:
--     public.users.id       REFERENCES auth.users(id)   ON DELETE CASCADE
--     every other table     REFERENCES public.users(id) ON DELETE CASCADE
-- so a single `DELETE FROM auth.users` tears down users, meal_plans,
-- nutrition_logs, workouts, achievements, custom_meals, water_logs, streaks,
-- custom_diets, consumed_meals and sync_documents — plus GoTrue's own
-- identities / sessions / refresh_tokens. Enumerating them here would be a list
-- to forget a table from; the FK graph cannot forget.
--
-- SECURITY. `SECURITY DEFINER` runs as the function owner (postgres), which is
-- the only way to touch `auth.users` — so the body must be paranoid:
--   • `SET search_path = ''` — every name below is schema-qualified. Without
--     this, a caller who prepends a schema to their search_path could bind
--     `users` to a table of their own and steer the delete.
--   • The uid comes from `auth.uid()` (the verified JWT), never an argument.
--     There is deliberately no `delete_account(user_id)` overload: a parameter
--     is an invitation to pass someone else's id, and this function runs as
--     superuser. Callers can only ever delete themselves.
--   • EXECUTE is revoked from PUBLIC/anon and granted to `authenticated` only.
--
-- STORAGE — READ THIS BEFORE TRUSTING THE `DELETE FROM storage.objects` BELOW.
-- Removing a row from storage.objects unlinks the object from the API but does
-- NOT necessarily reclaim the underlying S3 blob; only the Storage API does
-- that reliably. So the client deletes files through the Storage API FIRST
-- (services/account/AccountDeletion.ts → purgeRemoteStorage) and this statement
-- is the BACKSTOP for whatever that pass missed — a file uploaded from another
-- device, or a client that died mid-delete. Without it those rows would be
-- orphaned against a user id that no longer exists. Keep both halves.
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    -- Fail closed. An unauthenticated caller must never reach a superuser DELETE.
    IF uid IS NULL THEN
        RAISE EXCEPTION 'delete_account: no authenticated user'
            USING ERRCODE = '28000';  -- invalid_authorization_specification
    END IF;

    -- Backstop sweep (see STORAGE note above). Scoped by the same
    -- "<uid>/<file>" convention the bucket policies enforce in migration 0004.
    DELETE FROM storage.objects
     WHERE bucket_id IN ('avatars', 'progress-photos', 'gozlin-audio')
       AND (storage.foldername(name))[1] = uid::text;

    -- The one delete that matters. Everything else cascades from here.
    DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- The function is the privilege — hand it out narrowly. `anon` is excluded on
-- purpose: a signed-out caller has no auth.uid() and would only ever hit the
-- exception above, but revoking is cheaper than relying on that.
REVOKE ALL     ON FUNCTION public.delete_account() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.delete_account() FROM anon;
GRANT  EXECUTE ON FUNCTION public.delete_account() TO   authenticated;

COMMENT ON FUNCTION public.delete_account() IS
    'Irreversibly deletes the CALLING user (auth.uid()): storage objects, then '
    'the auth row, which cascades to every public table. GDPR Art. 17 / App '
    'Store 5.1.1(v). Takes no arguments by design — callers cannot name a victim.';
