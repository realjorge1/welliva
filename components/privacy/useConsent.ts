/**
 * useConsent — bridge hook for the Trust surface (`app/(tabs)/privacy.tsx`).
 *
 * Thin wiring over health-os/privacy + the signals coordinator. Exposes the consent
 * record (grouped, toggleable), the live "what's connected" rows, and a count of active
 * forward (Life Context) entries — the full forward model the user can see and revoke.
 * All domain logic lives in health-os; this is view-model shaping only.
 */
import {
  CONSENT_CATEGORIES,
  CONSENT_CATEGORY_META,
  consent,
  lifeContext,
  signalsCoordinator,
  type ConsentCategory,
  type ConsentGroup,
  type ConsentRecord,
  type WatchedSignal,
} from "@/health-os";
import { useCallback, useEffect, useState } from "react";

export interface ConsentRow {
  category: ConsentCategory;
  label: string;
  blurb: string;
  icon: string;
  group: ConsentGroup;
  granted: boolean;
  /** Future/not-implemented categories are shown but not toggleable. */
  disabled: boolean;
}

export interface UseConsent {
  loading: boolean;
  rows: ConsentRow[];
  watching: WatchedSignal[];
  /** Number of active forward (Life Context) entries Gozlin is tracking. */
  upcomingCount: number;
  toggle: (category: ConsentCategory, granted: boolean) => Promise<void>;
  reload: () => Promise<void>;
}

function toRows(record: ConsentRecord): ConsentRow[] {
  return CONSENT_CATEGORIES.map((category) => {
    const meta = CONSENT_CATEGORY_META[category];
    return {
      category,
      label: meta.label,
      blurb: meta.blurb,
      icon: meta.icon,
      group: meta.group,
      granted:
        category === "local_processing"
          ? true
          : (record.decisions[category]?.granted ?? false),
      disabled: meta.group === "future" || category === "local_processing",
    };
  });
}

export function useConsent(): UseConsent {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [watching, setWatching] = useState<WatchedSignal[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const reload = useCallback(async () => {
    const [record, watch, upcoming] = await Promise.all([
      consent.get(),
      signalsCoordinator.watching(),
      lifeContext.listActive(),
    ]);
    setRows(toRows(record));
    setWatching(watch);
    setUpcomingCount(upcoming.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = useCallback(
    async (category: ConsentCategory, granted: boolean) => {
      await consent.set(category, granted);
      await reload();
    },
    [reload],
  );

  return { loading, rows, watching, upcomingCount, toggle, reload };
}
