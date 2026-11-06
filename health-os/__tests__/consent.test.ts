import { describe, expect, it } from "vitest";

import { K } from "../platform/storage/keys";
import { ConsentRepository } from "../privacy/ConsentRepository";
import {
  CONSENT_CATEGORIES,
  CONSENT_CATEGORY_META,
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
  it("defaults: every sense and every way out is off; only on-device, coaching and measurement are on", () => {
    const rec = defaultConsent(NOW);
    expect(rec.version).toBe(CONSENT_VERSION);
    expect(isGrantedIn(rec, "local_processing")).toBe(true);
    // Default-on is reserved for behaviours over data the app already holds
    // (the owner's call for follow-ups, docs/gozlin/11 D1)...
    expect(isGrantedIn(rec, "experience_followups")).toBe(true);
    // ...and, since 31 October 2026, for MEASUREMENT. This used to read "nothing
    // that reads a new sense or sends anything out may ever default on", and the
    // second half of that is now a deliberate exception rather than a rule:
    // product_analytics and crash_diagnostics do send, to our own Supabase,
    // because opt-in measurement is answered only by a self-selected minority and
    // a health app whose crash rate and drop-off nobody can see is its own harm.
    // The exception is paid for in the open — the privacy policy was rewritten to
    // disclose it and LEGAL_VERSION went to 4, so everyone re-accepts once.
    //
    // It stays narrow by being enumerated, not by being skipped: the assertion
    // below pins the measurement group to EXACTLY these two, so a third
    // default-on sender cannot be added to the group and inherit the exemption.
    expect(isGrantedIn(rec, "product_analytics")).toBe(true);
    expect(isGrantedIn(rec, "crash_diagnostics")).toBe(true);
    expect(
      CONSENT_CATEGORIES.filter((c) => CONSENT_CATEGORY_META[c].group === "measurement").sort(),
      "A new category joined the `measurement` group. That group is exempt from " +
        "the default-off rule, so adding to it is a privacy decision: it needs a " +
        "policy change and a LEGAL_VERSION bump, not just a line here.",
    ).toEqual(["crash_diagnostics", "product_analytics"]);

    // Everything else — every sense, every reach — is off until asked.
    for (const c of CONSENT_CATEGORIES) {
      const group = CONSENT_CATEGORY_META[c].group;
      if (c === "local_processing" || group === "coaching" || group === "measurement") continue;
      expect(isGrantedIn(rec, c), `${c} must default to off`).toBe(false);
    }
  });

  it("reads a category the stored record predates as its default, not as off", () => {
    const old = {
      version: CONSENT_VERSION,
      decisions: { local_processing: { granted: true, at: "x" }, calendar: { granted: false, at: "x" } },
      updatedAt: "x",
    } as unknown as ConsentRecord;
    expect(isGrantedIn(old, "experience_followups")).toBe(true);
    expect(isGrantedIn(old, "wearable")).toBe(false);
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
