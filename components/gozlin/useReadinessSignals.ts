/**
 * useReadinessSignals — the two inputs Recovery reads besides training load.
 *
 * A wearable's last-known sleep/HRV, and the state-of-mind log (today's hours
 * slept, "Tired"/"Drained"). Both live in storage rather than AppContext, so
 * every screen that shows a recovery score has to load them itself — and the
 * Exercise screen once didn't, which is how it came to show one readiness score
 * while Gozlin, reading the same day, quoted another. One hook, so the two
 * cannot drift apart again.
 *
 * `currentDate` re-reads on a new day. The mood log is also kept live through
 * MindService's announcement: the check-in sheet lives in the Deck, so "4
 * hours, Drained" is usually logged while this hook is already mounted, and a
 * read-once copy would miss exactly that entry.
 */

import { wearableSource, type WearableSnapshot } from "@/health-os";
import { loadCheckins, subscribeMindEntries, type GozlinCheckin } from "@/services/gozlin";
import { useEffect, useState } from "react";

export interface ReadinessSignals {
  wearable: WearableSnapshot | null;
  checkins: GozlinCheckin[] | null;
}

export function useReadinessSignals(currentDate: string): ReadinessSignals {
  // Loaded async — the first render uses the load proxy, then folds these in.
  const [wearable, setWearable] = useState<WearableSnapshot | null>(null);
  useEffect(() => {
    void wearableSource.lastKnown().then(setWearable);
  }, [currentDate]);

  const [checkins, setCheckins] = useState<GozlinCheckin[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCheckins()
      .then((list) => {
        if (alive) setCheckins(list);
      })
      .catch(() => {});
    const stop = subscribeMindEntries((next) => setCheckins(next));
    return () => {
      alive = false;
      stop();
    };
  }, [currentDate]);

  return { wearable, checkins };
}
