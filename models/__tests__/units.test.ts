import { describe, expect, it } from "vitest";
import { detectUnits } from "../../utils/region";
import {
  formatHeight,
  formatWeight,
  heightBounds,
  heightFromParts,
  heightToParts,
  storedHeight,
  storedWeight,
  weightBounds,
  weightFromParts,
  weightToParts,
} from "../units";

const HEIGHT = { min: 100, max: 250 };
const WEIGHT = { min: 30, max: 300 };

describe("height", () => {
  it("reads every unit into centimetres", () => {
    expect(heightFromParts({ major: "178", minor: "" }, "cm")).toBe(178);
    expect(heightFromParts({ major: "1.78", minor: "" }, "m")).toBeCloseTo(178);
    expect(heightFromParts({ major: "1,78", minor: "" }, "m")).toBeCloseTo(178); // comma decimal
    expect(storedHeight(heightFromParts({ major: "5", minor: "10" }, "ftin")!)).toBe(178);
  });

  it("counts an empty inches box as zero, but both empty as no answer", () => {
    expect(storedHeight(heightFromParts({ major: "6", minor: "" }, "ftin")!)).toBe(183);
    expect(heightFromParts({ major: "", minor: "" }, "ftin")).toBeNull();
    expect(heightFromParts({ major: "", minor: "" }, "cm")).toBeNull();
    expect(heightFromParts({ major: "abc", minor: "" }, "cm")).toBeNull();
  });

  it("shows a stored height in each unit", () => {
    expect(heightToParts(178, "ftin")).toEqual({ major: "5", minor: "10" });
    expect(heightToParts(178, "m")).toEqual({ major: "1.78", minor: "" });
    expect(heightToParts(183, "ftin")).toEqual({ major: "6", minor: "0" }); // never "5 ft 12 in"
    expect(formatHeight(178, "ftin")).toBe("5′10″");
    expect(formatHeight(178, "cm")).toBe("178 cm");
  });

  it("survives any number of unit switches unchanged", () => {
    for (let cm = 100; cm <= 250; cm++) {
      for (const unit of ["ftin", "m", "cm"] as const) {
        // A switch shows parts; re-typing those exact parts must store the same cm
        // to within the unit's own resolution.
        const back = storedHeight(heightFromParts(heightToParts(cm, unit), unit)!);
        expect(Math.abs(back - cm)).toBeLessThanOrEqual(unit === "ftin" ? 2 : 0);
      }
    }
  });

  it("draws a range the validation will accept at both ends", () => {
    const ft = heightBounds(HEIGHT, "ftin");
    expect(ft).toEqual({ min: "3′4″", max: "8′2″" });
    const lo = heightFromParts({ major: "3", minor: "4" }, "ftin")!;
    const hi = heightFromParts({ major: "8", minor: "2" }, "ftin")!;
    expect(storedHeight(lo)).toBeGreaterThanOrEqual(HEIGHT.min);
    expect(storedHeight(hi)).toBeLessThanOrEqual(HEIGHT.max);
    expect(heightBounds(HEIGHT, "m")).toEqual({ min: "1.00", max: "2.50 m" });
    expect(heightBounds(HEIGHT, "cm")).toEqual({ min: "100", max: "250 cm" });
  });
});

describe("weight", () => {
  it("reads every unit into kilograms", () => {
    expect(weightFromParts({ major: "72.5", minor: "" }, "kg")).toBe(72.5);
    expect(storedWeight(weightFromParts({ major: "160", minor: "" }, "lb")!)).toBe(72.6);
    expect(storedWeight(weightFromParts({ major: "11", minor: "6" }, "stlb")!)).toBe(72.6);
    expect(storedWeight(weightFromParts({ major: "11", minor: "" }, "stlb")!)).toBe(69.9);
  });

  it("shows a stored weight in each unit", () => {
    expect(weightToParts(72.6, "lb")).toEqual({ major: "160", minor: "" });
    expect(weightToParts(72.6, "stlb")).toEqual({ major: "11", minor: "6" });
    expect(weightToParts(72, "kg")).toEqual({ major: "72", minor: "" }); // not "72.0"
    expect(formatWeight(72.6, "stlb")).toBe("11 st 6 lb");
  });

  it("draws a range the validation will accept at both ends", () => {
    expect(weightBounds(WEIGHT, "lb")).toEqual({ min: "67", max: "661 lb" });
    expect(weightBounds(WEIGHT, "stlb")).toEqual({ min: "4 st 11", max: "47 st 3" });
    const lo = storedWeight(weightFromParts({ major: "67", minor: "" }, "lb")!);
    const hi = storedWeight(weightFromParts({ major: "47", minor: "3" }, "stlb")!);
    expect(lo).toBeGreaterThanOrEqual(WEIGHT.min);
    expect(hi).toBeLessThanOrEqual(WEIGHT.max);
  });
});

describe("detectUnits", () => {
  it("starts people in the units they use for their own body", () => {
    expect(detectUnits("America/New_York")).toEqual({ height: "ftin", weight: "lb" });
    expect(detectUnits("America/Indiana/Indianapolis")).toEqual({ height: "ftin", weight: "lb" });
    expect(detectUnits("America/Toronto")).toEqual({ height: "ftin", weight: "lb" });
    expect(detectUnits("Europe/London")).toEqual({ height: "ftin", weight: "stlb" });
    expect(detectUnits("Europe/Dublin")).toEqual({ height: "ftin", weight: "stlb" });
    expect(detectUnits("Africa/Lagos")).toEqual({ height: "cm", weight: "kg" });
    expect(detectUnits("America/Sao_Paulo")).toEqual({ height: "cm", weight: "kg" });
    expect(detectUnits("Europe/Rome")).toEqual({ height: "cm", weight: "kg" });
  });
});
