/**
 * useExerciseDemo — resolve the ExerciseDB demo GIF for an exercise.
 * Returns null url while unresolved/unavailable; the UI renders nothing in
 * that case, so screens behave identically with media unconfigured.
 */
import { useEffect, useState } from "react";
import {
  isExerciseMediaConfigured,
  resolveDemoUrl,
} from "../services/ExerciseMediaService";

export function useExerciseDemo(
  exerciseId: string | undefined,
  exerciseName: string | undefined,
): { url: string | null; resolving: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setUrl(null);
    if (!exerciseId || !exerciseName || !isExerciseMediaConfigured()) return;
    let mounted = true;
    setResolving(true);
    void resolveDemoUrl(exerciseId, exerciseName)
      .then((resolved) => {
        if (mounted) setUrl(resolved);
      })
      .finally(() => {
        if (mounted) setResolving(false);
      });
    return () => {
      mounted = false;
    };
  }, [exerciseId, exerciseName]);

  return { url, resolving };
}
