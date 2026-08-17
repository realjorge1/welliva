/**
 * useIntelligence — the bridge hook for the Intelligence panel on `/knows`.
 *
 * Reads what the learning models currently believe (health-os/learning/engine)
 * and shapes nothing: the snapshot is already a view model, deliberately, so
 * that the gates deciding whether a learned number may be shown live next to
 * the models that earned it rather than in a component.
 *
 * REFIT IS NOT THIS HOOK'S JOB. The models are refitted once a day by the
 * rollover sweep (`useDayChange` → `runDailyLearning`), never on a screen mount.
 * Fitting Banister's five parameters and 40 SGD epochs every time someone opens
 * a tab would be pure waste — the inputs only change when a day closes. This
 * hook reads the persisted result.
 */
import { useProfile } from "@/contexts/AppContext";
import { readIntelligence, type IntelligenceSnapshot } from "@/health-os";
import { maintenanceTdee } from "@/services/NutritionService";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseIntelligence {
  loading: boolean;
  snapshot: IntelligenceSnapshot | null;
  reload: () => Promise<void>;
}

export function useIntelligence(): UseIntelligence {
  const { userBio } = useProfile();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);

  // The population baseline the learned figure is compared against. Recomputed
  // only when the bio fields it actually depends on change — `userBio` itself is
  // a new object on most renders.
  const mifflinTdee = useMemo(
    () => (userBio ? maintenanceTdee(userBio) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userBio?.sex, userBio?.weightKg, userBio?.heightCm, userBio?.age, userBio?.activityLevel],
  );

  const reload = useCallback(async () => {
    if (!userBio) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    try {
      setSnapshot(await readIntelligence({ mifflinTdee }));
    } finally {
      setLoading(false);
    }
  }, [userBio, mifflinTdee]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, snapshot, reload };
}
