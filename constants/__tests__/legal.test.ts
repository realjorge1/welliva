/**
 * LEGAL — the placeholder guard.
 *
 * WHY THIS FILE EXISTS. constants/legal.ts interpolates its identity constants
 * verbatim into the privacy policy, terms and medical disclaimer — the three
 * documents a user must accept before the app will ask them about pregnancy,
 * medication or kidney disease. Two of them once shipped as literal bracket
 * text (the jurisdiction, since filled, and a postal address, since removed by
 * the owner's choice on 14 November 2026 — the documents give an email only):
 *
 *     LEGAL_POSTAL_ADDRESS = "[registered business address — to be completed]"
 *
 * Nothing caught it. The file's own header warned about exactly this ("a
 * placeholder left here ships as a placeholder"), which is the point: a comment
 * asking a human to remember is not a control. Every other invariant in this
 * codebase is enforced by something that fails loudly, and consent text — the
 * one surface with legal consequences — had the weakest enforcement of all.
 *
 * So this is not a test of behaviour. It is the control: an assertion that the
 * documents contain no unfilled fields, wired into `npm test` and therefore into
 * CI, which gates the build. Filling the constants turns it green; a future
 * edit that reintroduces a placeholder turns it red before review, not after
 * submission.
 *
 * It also pins the two invariants that make LEGAL_VERSION meaningful, because a
 * consent record is only as good as the version stamped on it.
 *
 * Never turn a failure here green by loosening PLACEHOLDER or skipping a test:
 * fill the real value, or (as with the postal address) take the field out of
 * the documents by the owner's decision.
 */
import { describe, expect, it } from "vitest";

import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCS,
  LEGAL_DOC_ORDER,
  LEGAL_ENTITY,
  LEGAL_JURISDICTION,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "../legal";

/**
 * What an unfilled field looks like. Bracketed text is the giveaway — it is how
 * every placeholder in this file was written — plus the usual dev markers, in
 * case the next one is spelled TODO or TBD instead.
 */
const PLACEHOLDER = /\[[^\]]*\]|TODO|TBD|FIXME|XXX|to be completed|lorem ipsum/i;

/** Printed on every placeholder failure, so the fix travels with the CI log. */
const HOW_TO_FIX =
  "Fill the REAL value in constants/legal.ts. Do NOT invent one, do NOT loosen " +
  "PLACEHOLDER, do NOT skip this test — invented details in a privacy policy " +
  "users must accept are worse than a red build.";

const IDENTITY: Record<string, string> = {
  LEGAL_ENTITY,
  LEGAL_CONTACT_EMAIL,
  LEGAL_JURISDICTION,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  LEGAL_LAST_UPDATED,
};

describe("legal identity constants", () => {
  it.each(Object.entries(IDENTITY))(
    "%s is filled in, not a placeholder",
    (name, value) => {
      expect(
        value,
        `${name} is empty. It is interpolated into documents the user must ` +
          `accept, so it cannot ship blank.`,
      ).toBeTruthy();

      expect(
        PLACEHOLDER.test(value),
        `${name} still contains placeholder text: ${JSON.stringify(value)}\n` +
          `Replace it in constants/legal.ts with the real value — it is ` +
          `rendered verbatim in the privacy policy, terms and disclaimer.\n` +
          `\n` +
          `${HOW_TO_FIX}`,
      ).toBe(false);
    },
  );

  it("contact address is a usable email", () => {
    // The policy directs erasure and child-data requests here; a typo makes
    // those rights unexercisable.
    expect(LEGAL_CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("public document URLs are absolute https", () => {
    // Both stores require a reachable policy URL on the LISTING, not just
    // in-app. A relative or http URL fails review.
    for (const url of [PRIVACY_POLICY_URL, TERMS_URL]) {
      expect(url).toMatch(/^https:\/\/.+/);
    }
  });
});

describe("legal documents", () => {
  it("renders no placeholder text in any document body", () => {
    // The constants above are interpolated, but section copy is written by
    // hand — so scan the rendered text too, not just the inputs.
    for (const id of LEGAL_DOC_ORDER) {
      const doc = LEGAL_DOCS[id];
      const text = [
        doc.title,
        doc.summary,
        ...doc.sections.flatMap((s) => [
          s.heading,
          ...(s.body ?? []),
          ...(s.bullets ?? []),
        ]),
      ].join("\n");

      const offending = text
        .split("\n")
        .filter((line) => PLACEHOLDER.test(line));

      expect(
        offending,
        `${id} contains unfilled text:\n  ${offending.join("\n  ")}\n\n${HOW_TO_FIX}`,
      ).toEqual([]);
    }
  });

  it("every ordered document exists, and every document is ordered", () => {
    // A doc missing from the order is a doc the consent gate never shows —
    // silently collecting consent for less than it claims.
    expect([...LEGAL_DOC_ORDER].sort()).toEqual(Object.keys(LEGAL_DOCS).sort());
  });

  it("no document is empty", () => {
    for (const id of LEGAL_DOC_ORDER) {
      expect(LEGAL_DOCS[id].sections.length, `${id} has no sections`).toBeGreaterThan(0);
    }
  });
});

describe("versioning", () => {
  it("LEGAL_VERSION is a positive integer", () => {
    // Acceptance records compare against it; a float or 0 breaks the
    // re-consent check in services/legal/LegalAcceptance.ts.
    expect(Number.isInteger(LEGAL_VERSION)).toBe(true);
    expect(LEGAL_VERSION).toBeGreaterThan(0);
  });
});
