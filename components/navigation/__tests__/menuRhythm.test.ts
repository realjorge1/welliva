/**
 * THE DRAWER'S RHYTHM — the owner's "acres of space between Memory and
 * Upgrade", pinned across the phone heights it has to look right on.
 *
 * Body heights are the panel's height under the profile header: window height
 * minus the status bar and the ~76dp header. The owner's phone (screenshot
 * 2026-10-15) is ~790dp tall with a gesture bar that reports NO bottom inset.
 */

import { describe, expect, it } from "vitest";

import {
  GAP_MAX,
  GAP_MIN,
  LIFT_TIGHT,
  ROW_GAP,
  ROW_MAX,
  ROW_MIN,
  menuContentHeight,
  menuRhythm,
  type MenuShape,
} from "../menuRhythm";

const SHAPE: MenuShape = { listRows: 8, footerRows: 2, hairline: 0.36 };

/** Space left under Settings once the rhythm is laid out. */
function spareUnderSettings(body: number, inset: number) {
  const r = menuRhythm(body, inset, SHAPE);
  return body - inset - menuContentHeight(SHAPE, r.row, r.gap);
}

/** Space between the bottom of Memory and the top of Upgrade. */
function memoryToUpgrade(body: number, inset: number) {
  const r = menuRhythm(body, inset, SHAPE);
  return r.gap + SHAPE.hairline + r.gap;
}

describe("menuRhythm", () => {
  it("lays out tight before the panel has been measured", () => {
    expect(menuRhythm(0, 0, SHAPE)).toEqual({ row: ROW_MIN, gap: GAP_MIN, lift: LIFT_TIGHT });
  });

  it("keeps a short phone exactly as it was tuned — the list scrolls instead", () => {
    // TECNO F1-class: 569dp window, 24 status, 48 three-button nav bar.
    expect(menuRhythm(569 - 24 - 76, 48, SHAPE)).toEqual({
      row: ROW_MIN,
      gap: GAP_MIN,
      lift: LIFT_TIGHT,
    });
  });

  it("on the owner's phone: Settings lifts off the edge and the Memory→Upgrade gap is a section break, not acres", () => {
    const body = 790 - 35 - 76;
    const r = menuRhythm(body, 0, SHAPE);
    // Rows breathe, within bounds.
    expect(r.row).toBeGreaterThan(ROW_MIN);
    expect(r.row).toBeLessThanOrEqual(ROW_MAX);
    // Settings now sits well clear of the glass (it was 4dp).
    expect(spareUnderSettings(body, 0)).toBeGreaterThanOrEqual(40);
    expect(spareUnderSettings(body, 0)).toBeLessThanOrEqual(80);
    // The gap that was ~141dp of empty list is now two hairline margins.
    expect(memoryToUpgrade(body, 0)).toBeLessThanOrEqual(2 * GAP_MAX + 1);
  });

  it("never asks for more height than there is, at any phone height", () => {
    for (let body = 300; body <= 1400; body += 7) {
      for (const inset of [0, 16, 24, 34, 48]) {
        const r = menuRhythm(body, inset, SHAPE);
        const tightFits = body - inset - LIFT_TIGHT - menuContentHeight(SHAPE, ROW_MIN, GAP_MIN) > 0;
        if (!tightFits) continue; // nothing to spend: the list scrolls, as before
        expect(menuContentHeight(SHAPE, r.row, r.gap) + r.lift + inset).toBeLessThanOrEqual(body);
      }
    }
  });

  it("caps every stretch, so a tablet gets a roomy list rather than a stretched one", () => {
    const r = menuRhythm(1400, 20, SHAPE);
    expect(r.row).toBe(ROW_MAX);
    expect(r.gap).toBe(GAP_MAX);
    expect(memoryToUpgrade(1400, 20)).toBeLessThanOrEqual(2 * GAP_MAX + 1);
  });

  it("grows smoothly — a taller phone never gets smaller rows or gaps", () => {
    let prev = menuRhythm(400, 0, SHAPE);
    for (let body = 401; body <= 1200; body++) {
      const r = menuRhythm(body, 0, SHAPE);
      expect(r.row).toBeGreaterThanOrEqual(prev.row);
      expect(r.gap).toBeGreaterThanOrEqual(prev.gap);
      expect(r.lift).toBeGreaterThanOrEqual(prev.lift);
      prev = r;
    }
  });

  it("counts the list the way the panel draws it", () => {
    // 12 top pad + 8 rows + 8 gaps + hairline with its margins + the list's
    // foot, then the footer's hairline, head, 2 rows and the gap between them.
    const h = menuContentHeight(SHAPE, 50, 14);
    expect(h).toBeCloseTo(12 + 8 * 50 + 8 * ROW_GAP + (0.36 + 28) + 14 + (0.36 + 14 + 100 + ROW_GAP), 6);
  });
});
