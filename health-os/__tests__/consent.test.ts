import { describe, expect, it } from "vitest";

import { K } from "../platform/storage/keys";
import { ConsentRepository } from "../privacy/ConsentRepository";
import {
  CONSENT_CATEGORIES,
  CONSENT_VERSION,
  defaultConsent,
  grantedIntegrations,
  isGrantedIn,
  needsReconsent,
  reconcile,
  withDecision,
  type ConsentRecord,
} from "../privacy/consent";
import { MemoryStore } from "./helpers/MemoryStore";

const NOW = new Date("2026-06-29T09:00:00");

describe("consent (pure)", () => {
  it("defaults: only local_processing is granted", () => {
    const rec = defaultConsent(NOW);
    expect(rec.version).toBe(CONSENT_VERSION);
    expect(isGrantedIn(rec, "local_processing")).toBe(true);
    for (const c of CONSENT_CATEGORIES) {
      if (c === "local_processing") continue;
      expect(isGrantedIn(rec, c)).toBe(false);
    }
  });

  it("local_processing is always effectively granted, even if a record says otherwise", () => {
    const rec = withDecision(defaultConsent(NOW), "local_processing", false, NOW);
    expect(isGrantedIn(rec, "local_processing")).toBe(true);
  });

  it("withDecision flips one category without mutating the input", () => {
    const before = defaultConsent(NOW);
    const after = withDecision(before, "calendar", true, NOW);
    expect(isGrantedIn(before, "calendar")).toBe(false); // unchanged
    expect(isGrantedIn(after, "calendar")).toBe(true);
  });

  it("grantedIntegrations lists only switched-on integration categories", () => {
    let rec = defaultConsent(NOW);
    rec = withDecision(rec, "calendar", true, NOW);
    rec = withDecision(rec, "ai_cloud", true, NOW); // core, not an integration
    expect(grantedIntegrations(rec)).toEqual(["calendar"]);
  });

  it("reconcile fills in categories added since the record was written", () => {
    const partial = {
      version: CONSENT_VERSION,
      decisions: { local_processing: { granted: true, at: "x" } },
      updatedAt: "x",
    } as unknown as ConsentRecord;
    const fixed = reconcile(partial, NOW);
    expect(fixed).not.toBe(partial);
    for (const c of CONSENT_CATEGORIES) expect(fixed.decisions[c]).toBeDefined();
  });

  it("needsReconsent triggers when the stored version is behind", () => {
    expect(needsReconsent(defaultConsent(NOW))).toBe(false);
    expect(
      needsReconsent({ ...defaultConsent(NOW), version: CONSENT_VERSION - 1 }),
    ).toBe(true);
  });
});

describe("ConsentRepository (storage)", () => {
  it("seeds defaults on first read and persists them", async () => {
    const store = new MemoryStore();
    const repo = new ConsentRepository(store);
    expect(await repo.isGranted("calendar")).toBe(false);
    expect(await store.get<ConsentRecord | null>(K.CONSENT, null)).not.toBeNull();
  });

  it("grant / revoke round-trips through storage", async () => {
    const store = new MemoryStore();
    const repo = new ConsentRepository(store);
    await repo.grant("proactive_notifications", NOW);
    expect(await repo.isGranted("proactive_notifications")).toBe(true);
    await repo.revoke("proactive_notifications", NOW);
    expect(await repo.isGranted("proactive_notifications")).toBe(false);
  });

  it("never stores local_processing as denied", async () => {
    const store = new MemoryStore();
    const repo = new ConsentRepository(store);
    await repo.set("local_processing", false, NOW);
    expect(await repo.isGranted("local_processing")).toBe(true);
  });

  it("reset returns every decision to defaults", async () => {
    const store = new MemoryStore();
    const repo = new ConsentRepository(store);
    await repo.grant("wearable", NOW);
    await repo.grant("photo", NOW);
    await repo.reset(NOW);
    expect(await repo.grantedIntegrations()).toEqual([]);
  });
});
