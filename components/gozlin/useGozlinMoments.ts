/**
 * useGozlinMoments — the surface presence hook.
 *
 * Gives any screen the coach beats Gozlin wants to surface there, ranked. Built
 * on the shared Twin (useGozlinSnapshot) so it stays consistent with the full
 * coach, and the pure GozlinMomentEngine so the selection logic is testable and
 * lives outside the UI. Cheap to call from every tab.
 *
 * The retired-habit beat is folded in here rather than at each call site, so a
 * habit someone quit six weeks ago can resurface on ANY surface that shows a
 * moment — which is the whole point of it. It ranks below every live risk: a
 * memory should never push aside something happening today.
 */

import {
  buildMoments,
  type GozlinMoment,
  type GozlinSurface,
} from "@/services/gozlin";
import { useMemo } from "react";
import { useGozlinSnapshot } from "./useGozlinSnapshot";
import { useRetiredBeat } from "./useHabitTracker";

export interface UseGozlinMoments {
  /** All beats relevant to the surface, highest leverage first. */
  moments: GozlinMoment[];
  /** The single beat the surface should lead with (or null — never, in practice). */
  top: GozlinMoment | null;
}

export function useGozlinMoments(surface: GozlinSurface): UseGozlinMoments {
  const { twin } = useGozlinSnapshot();
  const retired = useRetiredBeat();

  const moments = useMemo(
    () => buildMoments({ twin, surface, retired }),
    [twin, surface, retired],
  );

  return { moments, top: moments[0] ?? null };
}
