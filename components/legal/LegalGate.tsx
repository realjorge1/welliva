/**
 * LEGAL GATE — "has this account accepted the current policies?" as context.
 *
 * Two consumers need the same answer and must never disagree:
 *   • AuthWrapper, which routes an un-accepted user to /legal/consent
 *   • the consent screen itself, which records the acceptance
 *
 * Holding it in one provider means accepting immediately unblocks the router —
 * no re-read, no flash of the gate on the way to onboarding.
 *
 * WHY IT WAITS FOR THE PROFILE RECONCILE. The acceptance record is an ordinary
 * synced key, so a user who accepted on their phone already has it — it just
 * arrives with the login-time pull. Deciding before that lands would ask them to
 * accept again on every new device. `isProfileReconciled` (AppContext) is the
 * same signal AuthWrapper waits on before choosing onboarding-vs-tabs.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/SupabaseAuthProvider";
import { useSystem } from "@/contexts/AppContext";
import { LEGAL_DOC_ORDER } from "@/constants/legal";
import {
  getLegalAcceptance,
  isAcceptanceCurrent,
  recordLegalAcceptance,
  type LegalAcceptance,
} from "@/services/legal/LegalAcceptance";

export type LegalGateStatus = "loading" | "required" | "accepted";

interface LegalGateValue {
  status: LegalGateStatus;
  /** The stored record, once accepted (drives the Settings "accepted on" line). */
  acceptance: LegalAcceptance | null;
  /** Persist acceptance for the signed-in account and open the gate. */
  accept: () => Promise<void>;
}

const LegalGateContext = createContext<LegalGateValue>({
  status: "loading",
  acceptance: null,
  accept: async () => {},
});

export function LegalGateProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isProfileReconciled } = useSystem();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<LegalGateStatus>("loading");
  const [acceptance, setAcceptance] = useState<LegalAcceptance | null>(null);

  useEffect(() => {
    let alive = true;

    // Nobody signed in (or still restoring the session) — nothing to decide.
    if (authLoading || !userId) {
      setStatus("loading");
      setAcceptance(null);
      return;
    }
    // Wait for the cloud profile so a synced acceptance isn't missed.
    if (!isProfileReconciled) return;

    getLegalAcceptance()
      .then((record) => {
        if (!alive) return;
        const ok = isAcceptanceCurrent(record, userId);
        setAcceptance(ok ? record : null);
        setStatus(ok ? "accepted" : "required");
      })
      .catch((e) => {
        // A storage failure must not silently let someone through.
        console.warn("LegalGate: failed to read acceptance", e);
        if (!alive) return;
        setAcceptance(null);
        setStatus("required");
      });

    return () => {
      alive = false;
    };
  }, [authLoading, userId, isProfileReconciled]);

  const accept = useCallback(async () => {
    const record = await recordLegalAcceptance(userId, LEGAL_DOC_ORDER);
    setAcceptance(record);
    setStatus("accepted");
  }, [userId]);

  const value = useMemo<LegalGateValue>(
    () => ({ status, acceptance, accept }),
    [status, acceptance, accept],
  );

  return (
    <LegalGateContext.Provider value={value}>
      {children}
    </LegalGateContext.Provider>
  );
}

export function useLegalGate(): LegalGateValue {
  return useContext(LegalGateContext);
}
