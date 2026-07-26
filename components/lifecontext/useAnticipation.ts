/**
 * useAnticipation — bridge hook for P1 (the Anticipation engine).
 *
 * Assembles the four inputs the engine reads — the Twin + health profile
 * (useGozlinSnapshot), active Life Context, and last-known weather — and returns the
 * computed CoachingMode + ranked, time-aware anticipations. Pure engine, thin wiring.
 */
import { useGozlinSnapshot } from "@/components/gozlin";
import {
  lifeContext,
  weatherSource,
  wearableSource,
  weatherWorkoutHint,
  type LifeEvent,
  type WeatherSnapshot,
  type WearableSnapshot,
} from "@/health-os";
import { buildAnticipations, loadIdentity, type AnticipationResult } from "@/services/gozlin";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseAnticipation extends AnticipationResult {
  loading: boolean;
  reload: () => Promise<void>;
}

export function useAnticipation(): UseAnticipation {
  const { twin, snapshot } = useGozlinSnapshot();
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [wearable, setWearable] = useState<WearableSnapshot | null>(null);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [evts, wx, wear, identity] = await Promise.all([
      lifeContext.listActive(),
      weatherSource.lastKnown(),
      wearableSource.lastKnown(),
      loadIdentity(),
    ]);
    setLifeEvents(evts);
    setWeather(wx);
    setWearable(wear);
    // Free-text health facts the user told Gozlin (L3 constraints) feed anticipation too.
    setConstraints(identity.constraints ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const result = useMemo(
    () =>
      buildAnticipations({
        twin,
        bio: snapshot.bio,
        lifeEvents,
        healthConstraints: constraints,
        weather,
        weatherHint: weather ? weatherWorkoutHint(weather) : null,
        wearable,
      }),
    [twin, snapshot.bio, lifeEvents, constraints, weather, wearable],
  );

  return { ...result, loading, reload };
}
