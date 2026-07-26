/**
 * useFitnessProfile — the module's profile as live React state.
 *
 * Loads once, then stays in sync across every mounted screen through the
 * store's in-process change feed. All writes flow through the store so
 * persistence and notification stay in one place.
 */

import { useCallback, useEffect, useState } from "react";
import {
  createDefaultProfile,
  loadFitnessProfile,
  saveFitnessProfile,
  subscribeFitnessProfile,
  toggleFavorite as toggleFavoritePure,
  updateFitnessProfile,
  type FitnessProfilePatch,
} from "../services/FitnessProfileStore";
import type { FitnessProfile } from "../types";

export interface UseFitnessProfile {
  profile: FitnessProfile;
  /** False until the stored profile has been read (avoid flashing defaults). */
  ready: boolean;
  update: (patch: FitnessProfilePatch) => Promise<void>;
  toggleFavorite: (workoutId: string) => Promise<void>;
  isFavorite: (workoutId: string) => boolean;
}

export function useFitnessProfile(): UseFitnessProfile {
  const [profile, setProfile] = useState<FitnessProfile>(() => createDefaultProfile());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadFitnessProfile().then((p) => {
      if (mounted) {
        setProfile(p);
        setReady(true);
      }
    });
    const unsubscribe = subscribeFitnessProfile((p) => {
      if (mounted) setProfile(p);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback(async (patch: FitnessProfilePatch) => {
    await updateFitnessProfile(patch);
  }, []);

  const toggleFavorite = useCallback(
    async (workoutId: string) => {
      const current = await loadFitnessProfile();
      await saveFitnessProfile(toggleFavoritePure(current, workoutId));
    },
    [],
  );

  const isFavorite = useCallback(
    (workoutId: string) => profile.favorites.includes(workoutId),
    [profile.favorites],
  );

  return { profile, ready, update, toggleFavorite, isFavorite };
}
