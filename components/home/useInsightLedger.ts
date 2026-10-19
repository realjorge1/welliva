/**
 * useInsightLedger — the opened-insights record, live, for any screen.
 *
 * `ready` is the part callers must respect. Until the first read lands the
 * ledger is empty, and a screen that filters against an empty ledger shows
 * every insight the user has already opened for a frame before hiding it — a
 * notification that flashes back and then vanishes is far worse than one that
 * arrives a beat late. Gate the surface on `ready`.
 */
import {
  loadLedger,
  subscribeLedger,
  type InsightEntry,
} from "@/services/gozlin/InsightLedger";
import { useEffect, useState } from "react";

export interface UseInsightLedger {
  /** Newest first. */
  ledger: InsightEntry[];
  /** False until the stored ledger has been read once. */
  ready: boolean;
}

export function useInsightLedger(): UseInsightLedger {
  const [ledger, setLedger] = useState<InsightEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () => {
      void loadLedger().then((list) => {
        if (!alive) return;
        setLedger(list);
        setReady(true);
      });
    };
    read();
    const off = subscribeLedger(read);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return { ledger, ready };
}
