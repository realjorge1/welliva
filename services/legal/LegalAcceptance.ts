/**
 * LEGAL ACCEPTANCE — the record of which legal version this account agreed to.
 *
 * One key, one small record. It answers exactly one question for the router:
 * "may this signed-in user proceed into the app?" (components/AuthWrapper.tsx).
 *
 * WHY THE USER ID IS STORED WITH IT. AsyncStorage is global to the device, not
 * to the account. UserScope purges app keys when a different account signs in,
 * but the gate must not depend on that purge having run: if the stored record
 * belongs to someone else, it does not count. A stale record can therefore only
 * ever fail CLOSED (ask again), never open.
 *
 * WHY THE VERSION IS STORED WITH IT. Accepting v1 is not accepting v2. Bumping
 * LEGAL_VERSION in constants/legal.ts re-gates every user on next launch, which
 * is the whole point of having a version.
 *
 * The key is a normal `@welliva_*` key, so it follows the account through cloud
 * sync (a user who accepted on their phone isn't asked again on their tablet)
 * and is erased by "Reset data" (after which they are asked again — correct).
 */
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";
import { LEGAL_VERSION } from "../../constants/legal";

export interface LegalAcceptance {
  /** LEGAL_VERSION at the moment of acceptance. */
  version: number;
  /** ISO timestamp of the tap. */
  acceptedAt: string;
  /** The account that accepted. Null only for pre-account legacy records. */
  userId: string | null;
  /** Which documents the gate presented — an audit trail if the set grows. */
  documents: string[];
}

/** The raw stored record, or null if this device has none. */
export async function getLegalAcceptance(): Promise<LegalAcceptance | null> {
  return readJSON<LegalAcceptance | null>(KEYS.LEGAL_ACCEPTANCE, null);
}

/**
 * Does this record clear `userId` for the CURRENT legal version? Pure, so the
 * gate can decide from a record it already read.
 *
 * False whenever anything is off — no record, an older version, or a record
 * belonging to a different account. Failing closed is the only safe direction:
 * the cost is one extra screen, the cost of failing open is shipping an app
 * that collects pregnancy and medication data without consent.
 */
export function isAcceptanceCurrent(
  record: LegalAcceptance | null,
  userId: string | null | undefined,
): boolean {
  if (!record) return false;
  if (record.version !== LEGAL_VERSION) return false;
  if (userId && record.userId && record.userId !== userId) return false;
  return true;
}

/** Storage-backed form of {@link isAcceptanceCurrent}. */
export async function hasAcceptedCurrentLegal(
  userId: string | null | undefined,
): Promise<boolean> {
  return isAcceptanceCurrent(await getLegalAcceptance(), userId);
}

/** Store the acceptance. Returns the record so callers can hold it in state. */
export async function recordLegalAcceptance(
  userId: string | null | undefined,
  documents: string[],
  now: Date = new Date(),
): Promise<LegalAcceptance> {
  const record: LegalAcceptance = {
    version: LEGAL_VERSION,
    acceptedAt: now.toISOString(),
    userId: userId ?? null,
    documents,
  };
  await writeJSON(KEYS.LEGAL_ACCEPTANCE, record);
  return record;
}
