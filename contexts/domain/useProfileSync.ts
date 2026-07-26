/**
 * useProfileSync — the cloud profile-sync engine, extracted verbatim from
 * AppContext so the provider stays a thinner composition root (M4).
 *
 * Owns the bio/goals ↔ Supabase `users` row round-trip and the document-mirror
 * auto-sync loop, and nothing else:
 *   • Login-time reconcile — pull the remote profile once per signed-in user
 *     (after local load), then ADOPT it (a newer copy from another device) or
 *     PUSH the local one up. Purges a shared device first so one account's data
 *     never leaks into another's session.
 *   • Debounced push of local profile edits, parked until the reconcile lands.
 *   • Teardown of the auto-sync write-observer + AppState listener.
 *
 * Every path is fail-soft — a sync miss must never block sign-in or throw into
 * the UI. Behavior is identical to the inlined version; this is a pure move:
 * the same refs, the same dependency arrays, the same ordering.
 */
import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";

import type { NutritionTargets } from "../../models/nutrition";
import type { UserBio, UserGoals } from "../../models/user";
import { calculateNutritionTargets } from "../../services/NutritionService";
import {
  getLastSyncedAt,
  pullProfile,
  pushProfile,
  reconcileDecision,
} from "../../services/sync/ProfileSync";
import { ensureDeviceOwnedBy } from "../../services/sync/UserScope";
import { reconcileOnLogin, startAutoSync } from "../../services/sync/SyncEngine";
import { KEYS, writeJSON, writeString } from "../../services/OfflineStorage";

interface Params {
  /** The signed-in user (null when signed out); all cloud sync is gated on it. */
  user: User | null;
  /** True until the offline load completes — the reconcile waits for it. */
  isLoading: boolean;
  /** Latest local bio/goals, read through refs inside the effects. */
  userBio: UserBio | null;
  userGoals: UserGoals;
  /** Setters used when ADOPTING a remote profile. */
  setUserBio: Dispatch<SetStateAction<UserBio | null>>;
  setNutritionTargets: Dispatch<SetStateAction<NutritionTargets | null>>;
  setUserGoals: Dispatch<SetStateAction<UserGoals>>;
  /** Re-hydrate React state from storage after a login reconcile (boot's path). */
  loadData: () => Promise<void>;
}

export function useProfileSync({
  user,
  isLoading,
  userBio,
  userGoals,
  setUserBio,
  setNutritionTargets,
  setUserGoals,
  loadData,
}: Params): { isProfileReconciled: boolean } {
  // True once the login-time cloud profile pull+reconcile has finished for the
  // signed-in user (or immediately, when signed out). Routing waits on this so a
  // returning user on a fresh device isn't shown onboarding before their cloud
  // profile arrives.
  const [isProfileReconciled, setIsProfileReconciled] = useState(false);

  // Latest bio/goals, readable inside the login-reconcile effect without making
  // it a dependency (which would re-run it on every edit).
  const userBioRef = useRef(userBio);
  userBioRef.current = userBio;
  const userGoalsRef = useRef(userGoals);
  userGoalsRef.current = userGoals;
  // Which user id we've reconciled with the cloud this session.
  const profileHydratedForRef = useRef<string | null>(null);
  // True once the login-time pull+reconcile has completed — the push effect
  // stays parked until then so a local write can't clobber a newer remote.
  const profileHydrateDoneRef = useRef(false);
  // Set when we adopt a remote profile, so the resulting state change doesn't
  // immediately echo back up as a push.
  const profileSkipPushRef = useRef(false);
  // Debounce handle for pushes.
  const profilePushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Teardown for the document-sync auto-capture loop (write observer + AppState).
  const autoSyncCleanupRef = useRef<null | (() => void)>(null);

  // Login-time reconcile: pull the remote profile once per signed-in user (after
  // local load), then either ADOPT it (a newer copy from another device) or PUSH
  // the local one up. Never throws into the UI.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Signed out — stop the sync loop and reset so the next sign-in
      // re-reconciles from scratch.
      autoSyncCleanupRef.current?.();
      autoSyncCleanupRef.current = null;
      profileHydratedForRef.current = null;
      profileHydrateDoneRef.current = false;
      setIsProfileReconciled(false);
      return;
    }
    if (profileHydratedForRef.current === user.id) return;
    profileHydratedForRef.current = user.id;
    profileHydrateDoneRef.current = false;
    setIsProfileReconciled(false);

    (async () => {
      try {
        // FIRST: make sure this device's local data belongs to THIS account.
        // If a different user was last here (shared device), everything is wiped
        // before we read or push anything — no cross-account leak (finding #4).
        const purged = await ensureDeviceOwnedBy(user.id);

        const [remote, lastSyncedAt] = await Promise.all([
          pullProfile(user.id),
          getLastSyncedAt(),
        ]);
        const localBio = userBioRef.current;
        const decision = reconcileDecision({ localBio, remote, lastSyncedAt });
        // After a purge the in-memory refs still hold the PREVIOUS user's bio, so
        // adopt the incoming account's cloud profile and never push the stale one.
        const shouldAdopt =
          (decision === "adopt-remote" || purged) && !!remote?.bio;

        if (shouldAdopt && remote?.bio) {
          // A newer/owning profile exists in the cloud — make the device match it.
          profileSkipPushRef.current = true;
          setUserBio(remote.bio);
          setNutritionTargets(calculateNutritionTargets(remote.bio));
          await writeJSON(KEYS.USER_BIO, remote.bio);
          if (remote.goals) {
            setUserGoals(remote.goals);
            await writeJSON(KEYS.USER_GOALS, remote.goals);
          }
          if (remote.updatedAt) {
            await writeString(KEYS.PROFILE_SYNCED_AT, remote.updatedAt);
          }
        } else if (localBio && !purged) {
          // We're the source of truth — upload the local profile. Guarded by
          // !purged so we never push user A's leftover bio into user B's row.
          await pushProfile({
            userId: user.id,
            email: user.email ?? null,
            bio: localBio,
            goals: userGoalsRef.current,
          });
        }

        // Round-trip ALL logged data + Gozlin memory via the document mirror:
        // download anything newer from the cloud, then push our local changes
        // (including the direct-AsyncStorage writers the observer can't see).
        // Fail-soft — a sync miss must never block sign-in.
        await reconcileOnLogin(user.id);
        // Re-hydrate React state from storage so anything just downloaded shows
        // without a restart. loadData is the same path boot uses.
        await loadData();
      } catch (e) {
        console.warn("AppContext: profile hydrate failed:", e);
      } finally {
        profileHydrateDoneRef.current = true;
        setIsProfileReconciled(true);
        // Start capturing local writes for this user (idempotent per user).
        if (!autoSyncCleanupRef.current) {
          autoSyncCleanupRef.current = startAutoSync(user.id);
        }
      }
    })();
    // Reconcile is keyed on the user + load state only; latest bio/goals are read
    // through refs so edits don't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  // Stop the sync loop (unregister the write observer + AppState listener) when
  // the app tears down, so a stale observer can't outlive this provider.
  useEffect(
    () => () => {
      autoSyncCleanupRef.current?.();
      autoSyncCleanupRef.current = null;
    },
    [],
  );

  // Push local profile edits up, debounced. Parked until the login reconcile
  // finishes so an initial local write can't clobber a newer remote.
  useEffect(() => {
    if (isLoading || !user || !userBio) return;
    if (!profileHydrateDoneRef.current) return;
    if (profileSkipPushRef.current) {
      profileSkipPushRef.current = false;
      return;
    }
    if (profilePushTimerRef.current) clearTimeout(profilePushTimerRef.current);
    profilePushTimerRef.current = setTimeout(() => {
      void pushProfile({
        userId: user.id,
        email: user.email ?? null,
        bio: userBio,
        goals: userGoals,
      });
    }, 1200);
    return () => {
      if (profilePushTimerRef.current) clearTimeout(profilePushTimerRef.current);
    };
  }, [userBio, userGoals, user, isLoading]);

  return { isProfileReconciled };
}
