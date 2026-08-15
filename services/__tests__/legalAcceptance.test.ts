/**
 * The legal gate's decision function.
 *
 * These cases exist because the gate is the only thing standing between a fresh
 * sign-in and a screen that asks for pregnancy status and medication. Each test
 * pins a way the gate must FAIL CLOSED — wrong user, older policy, no record —
 * because every one of those failing open ships an app that collects sensitive
 * health data without consent.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { LEGAL_VERSION } from "../../constants/legal";
import { KEYS } from "../OfflineStorage";
import {
  getLegalAcceptance,
  hasAcceptedCurrentLegal,
  isAcceptanceCurrent,
  recordLegalAcceptance,
  type LegalAcceptance,
} from "../legal/LegalAcceptance";

const USER_A = "user-a";
const USER_B = "user-b";

const record = (over: Partial<LegalAcceptance> = {}): LegalAcceptance => ({
  version: LEGAL_VERSION,
  acceptedAt: "2026-07-26T10:00:00.000Z",
  userId: USER_A,
  documents: ["privacy", "terms", "disclaimer"],
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.removeItem(KEYS.LEGAL_ACCEPTANCE);
});

describe("isAcceptanceCurrent", () => {
  it("accepts a current record for the same user", () => {
    expect(isAcceptanceCurrent(record(), USER_A)).toBe(true);
  });

  it("rejects a missing record", () => {
    expect(isAcceptanceCurrent(null, USER_A)).toBe(false);
  });

  it("rejects another account's record — storage is device-wide, consent is not", () => {
    expect(isAcceptanceCurrent(record({ userId: USER_B }), USER_A)).toBe(false);
  });

  it("rejects an older policy version — accepting v1 is not accepting v2", () => {
    expect(isAcceptanceCurrent(record({ version: LEGAL_VERSION - 1 }), USER_A)).toBe(
      false,
    );
  });

  it("rejects a newer version too (downgraded build, unknown text)", () => {
    expect(isAcceptanceCurrent(record({ version: LEGAL_VERSION + 1 }), USER_A)).toBe(
      false,
    );
  });

  it("honours a legacy record with no user id rather than re-prompting", () => {
    expect(isAcceptanceCurrent(record({ userId: null }), USER_A)).toBe(true);
  });
});

describe("recordLegalAcceptance", () => {
  it("stores the version, account and documents, and round-trips", async () => {
    const now = new Date("2026-07-26T12:34:56.000Z");
    const saved = await recordLegalAcceptance(USER_A, ["privacy", "terms"], now);

    expect(saved).toEqual({
      version: LEGAL_VERSION,
      acceptedAt: now.toISOString(),
      userId: USER_A,
      documents: ["privacy", "terms"],
    });
    expect(await getLegalAcceptance()).toEqual(saved);
  });

  it("opens the gate for the accepting account only", async () => {
    await recordLegalAcceptance(USER_A, ["privacy"]);

    expect(await hasAcceptedCurrentLegal(USER_A)).toBe(true);
    expect(await hasAcceptedCurrentLegal(USER_B)).toBe(false);
  });
});

describe("hasAcceptedCurrentLegal", () => {
  it("is false on a fresh install", async () => {
    expect(await hasAcceptedCurrentLegal(USER_A)).toBe(false);
  });

  it("is false again after a policy version bump", async () => {
    await AsyncStorage.setItem(
      KEYS.LEGAL_ACCEPTANCE,
      JSON.stringify(record({ version: LEGAL_VERSION - 1 })),
    );
    expect(await hasAcceptedCurrentLegal(USER_A)).toBe(false);
  });
});
