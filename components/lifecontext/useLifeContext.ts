/**
 * useLifeContext — the bridge hook for the "What's coming up" screen.
 *
 * Connects the health-os Life Context repository to the screen and shapes its entries
 * into view rows (countdown, phase, when-label). All domain logic lives in
 * health-os/lifecontext/*; this hook is wiring + view-model shaping, mirroring
 * components/memory/useMemoryCenter.ts.
 */
import {
  countdownLabel,
  daysUntil as daysUntilOf,
  KIND_META,
  lifeContext,
  phaseOf,
  todayDate,
  type LifeEvent,
  type LifeEventInput,
  type LifeEventKind,
  type LifePhase,
} from "@/health-os";
import { useCallback, useEffect, useState } from "react";

export interface LifeRow {
  id: string;
  kind: LifeEventKind;
  title: string;
  icon: string;
  /** "Aug 12" or "Aug 12 – 18". */
  whenLabel: string;
  /** "in 12 days" / "tomorrow" / "today" / "happening now". */
  countdown: string;
  daysUntil: number;
  phase: LifePhase;
  note?: string;
  raw: LifeEvent;
}

const MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDay(date: string): string {
  const [, m, d] = date.split("-").map((n) => parseInt(n, 10));
  return `${MONTH[(m || 1) - 1]} ${d}`;
}

function whenLabel(e: LifeEvent): string {
  if (!e.window.end || e.window.end === e.window.start) return fmtDay(e.window.start);
  // Same month → "Aug 12 – 18", else "Aug 28 – Sep 3".
  const sameMonth = e.window.start.slice(0, 7) === e.window.end.slice(0, 7);
  const endLabel = sameMonth
    ? e.window.end.split("-")[2].replace(/^0/, "")
    : fmtDay(e.window.end);
  return `${fmtDay(e.window.start)} – ${endLabel}`;
}

function toRow(e: LifeEvent, today: string): LifeRow {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    icon: KIND_META[e.kind].icon,
    whenLabel: whenLabel(e),
    countdown: countdownLabel(e, today),
    daysUntil: daysUntilOf(e, today),
    phase: phaseOf(e, today),
    note: e.note,
    raw: e,
  };
}

export interface UseLifeContext {
  loading: boolean;
  rows: LifeRow[];
  reload: () => Promise<void>;
  add: (input: LifeEventInput) => Promise<void>;
  complete: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useLifeContext(): UseLifeContext {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LifeRow[]>([]);

  const reload = useCallback(async () => {
    const today = todayDate();
    const active = await lifeContext.listActive();
    setRows(active.map((e) => toRow(e, today)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (input: LifeEventInput) => {
      await lifeContext.add(input);
      await reload();
    },
    [reload],
  );

  const complete = useCallback(
    async (id: string) => {
      await lifeContext.complete(id);
      await reload();
    },
    [reload],
  );

  const dismiss = useCallback(
    async (id: string) => {
      await lifeContext.dismiss(id);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await lifeContext.remove(id);
      await reload();
    },
    [reload],
  );

  return { loading, rows, reload, add, complete, dismiss, remove };
}
