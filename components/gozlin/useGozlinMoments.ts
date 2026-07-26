/**
 * useGozlinMoments — the surface presence hook.
 *
 * Gives any screen the coach beats Gozlin wants to surface there, ranked. Built
 * on the shared Twin (useGozlinSnapshot) so it stays consistent with the full
 * coach, and the pure GozlinMomentEngine so the selection logic is testable and
 * lives outside the UI. Cheap to call from every tab.
 */

import {
  buildMoments,
  type GozlinMoment,
  type GozlinSurface,
} from "@/services/gozlin";
import { useMemo } from "react";
import { useGozlinSnapshot } from "./useGozlinSnapshot";

export interface UseGozlinMoments {
  /** All beats relevant to the surface, highest leverage first. */
  moments: GozlinMoment[];
  /** The single beat the surface should lead with (or null — never, in practice). */
  top: GozlinMoment | null;
}

export function useGozlinMoments(surface: GozlinSurface): UseGozlinMoments {
  const { twin } = useGozlinSnapshot();

  const moments = useMemo(
    () => buildMoments({ twin, surface }),
    [twin, surface],
  );

  return { moments, top: moments[0] ?? null };
}
