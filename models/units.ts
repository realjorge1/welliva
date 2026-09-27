/**
 * UNITS — how a person says their height and weight, and how we store it.
 *
 * STORAGE NEVER CHANGES. The bio holds centimetres and kilograms; every engine
 * (Mifflin–St Jeor, the diet scorer, body logs, sync) reads those. Units are a
 * property of the conversation, not of the data: this module turns what was
 * typed into cm/kg and back, and nothing else in the app needs to know.
 *
 * THREE UNITS EACH, the ones people actually use for their own body:
 *   height — centimetres (most of the world), feet & inches (US, UK, Canada,
 *            Ireland), metres (much of Europe, Latin America and Africa say
 *            "1.78")
 *   weight — kilograms (most of the world), pounds (US, Canada), stones &
 *            pounds (the UK and Ireland weigh people in stone)
 *
 * NO DRIFT. A switch of unit re-derives what is shown from the stored value; it
 * never converts the displayed number again. So 178 cm → 5′10″ → back to cm
 * reads 178, not 178 → 177.8 → 177.
 */

export type HeightUnit = "cm" | "ftin" | "m";
export type WeightUnit = "kg" | "lb" | "stlb";

export interface MeasurementUnits {
  height: HeightUnit;
  weight: WeightUnit;
}

export const METRIC_UNITS: MeasurementUnits = { height: "cm", weight: "kg" };

export interface UnitOption<U extends string> {
  value: U;
  /** Compact, for the switch: "ft · in". */
  label: string;
  /** Spoken and full: "Feet and inches". */
  name: string;
}

export const HEIGHT_UNITS: readonly UnitOption<HeightUnit>[] = [
  { value: "cm", label: "cm", name: "Centimetres" },
  { value: "ftin", label: "ft · in", name: "Feet and inches" },
  { value: "m", label: "m", name: "Metres" },
];

export const WEIGHT_UNITS: readonly UnitOption<WeightUnit>[] = [
  { value: "kg", label: "kg", name: "Kilograms" },
  { value: "lb", label: "lb", name: "Pounds" },
  { value: "stlb", label: "st · lb", name: "Stones and pounds" },
];

/** A measurement as typed: one number, or two for feet+inches / stones+pounds. */
export interface MeasureParts {
  major: string;
  minor: string;
}

export const EMPTY_PARTS: MeasureParts = { major: "", minor: "" };

/** One input box: what follows it, how long it may be, whether it takes a decimal. */
export interface FieldSpec {
  suffix: string;
  maxLength: number;
  decimal: boolean;
}

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;
const IN_PER_FT = 12;
const LB_PER_ST = 14;

/** "1,78" is how half the world writes 1.78 — both parse. Empty or junk → null. */
function parseNum(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const trimZero = (n: number, dp: number) => String(Number(n.toFixed(dp)));

// ── Height ────────────────────────────────────────────────────────────────

export function heightFields(unit: HeightUnit): FieldSpec[] {
  switch (unit) {
    case "ftin":
      return [
        { suffix: "ft", maxLength: 1, decimal: false },
        { suffix: "in", maxLength: 2, decimal: false },
      ];
    case "m":
      return [{ suffix: "m", maxLength: 4, decimal: true }];
    default:
      return [{ suffix: "cm", maxLength: 3, decimal: false }];
  }
}

/**
 * Centimetres from what was typed, or null when nothing usable was. For feet
 * and inches, an empty inches box counts as 0 — "5 ft" is a real height — but
 * both boxes empty is no answer at all.
 */
export function heightFromParts(parts: MeasureParts, unit: HeightUnit): number | null {
  const major = parseNum(parts.major);
  if (unit === "ftin") {
    const minor = parseNum(parts.minor);
    if (major === null && minor === null) return null;
    return ((major ?? 0) * IN_PER_FT + (minor ?? 0)) * CM_PER_IN;
  }
  if (major === null) return null;
  return unit === "m" ? major * 100 : major;
}

/** What to show for a stored height, in a unit. */
export function heightToParts(cm: number, unit: HeightUnit): MeasureParts {
  switch (unit) {
    case "ftin": {
      const inches = Math.round(cm / CM_PER_IN);
      return { major: String(Math.floor(inches / IN_PER_FT)), minor: String(inches % IN_PER_FT) };
    }
    case "m":
      return { major: (cm / 100).toFixed(2), minor: "" };
    default:
      return { major: String(Math.round(cm)), minor: "" };
  }
}

/** "178 cm", "1.78 m", "5′10″". */
export function formatHeight(cm: number, unit: HeightUnit): string {
  const p = heightToParts(cm, unit);
  if (unit === "ftin") return `${p.major}′${p.minor}″`;
  return `${p.major} ${unit}`;
}

/**
 * The accepted range, in the user's unit, rounded INWARD — the lower bound up,
 * the upper bound down — so the guide can never show a number that the
 * validation (in centimetres) would then reject.
 */
export function heightBounds(
  range: { min: number; max: number },
  unit: HeightUnit,
): { min: string; max: string } {
  switch (unit) {
    case "ftin": {
      const lo = Math.ceil(range.min / CM_PER_IN);
      const hi = Math.floor(range.max / CM_PER_IN);
      const f = (i: number) => `${Math.floor(i / IN_PER_FT)}′${i % IN_PER_FT}″`;
      return { min: f(lo), max: f(hi) };
    }
    case "m":
      return {
        min: (Math.ceil(range.min) / 100).toFixed(2),
        max: `${(Math.floor(range.max) / 100).toFixed(2)} m`,
      };
    default:
      return { min: String(Math.ceil(range.min)), max: `${Math.floor(range.max)} cm` };
  }
}

// ── Weight ────────────────────────────────────────────────────────────────

export function weightFields(unit: WeightUnit): FieldSpec[] {
  switch (unit) {
    case "stlb":
      return [
        { suffix: "st", maxLength: 2, decimal: false },
        { suffix: "lb", maxLength: 2, decimal: false },
      ];
    case "lb":
      return [{ suffix: "lb", maxLength: 5, decimal: true }];
    default:
      return [{ suffix: "kg", maxLength: 5, decimal: true }];
  }
}

/** Kilograms from what was typed, or null. An empty pounds box under stones is 0. */
export function weightFromParts(parts: MeasureParts, unit: WeightUnit): number | null {
  const major = parseNum(parts.major);
  if (unit === "stlb") {
    const minor = parseNum(parts.minor);
    if (major === null && minor === null) return null;
    return ((major ?? 0) * LB_PER_ST + (minor ?? 0)) * KG_PER_LB;
  }
  if (major === null) return null;
  return unit === "lb" ? major * KG_PER_LB : major;
}

/** What to show for a stored weight, in a unit. */
export function weightToParts(kg: number, unit: WeightUnit): MeasureParts {
  switch (unit) {
    case "stlb": {
      const lb = Math.round(kg / KG_PER_LB);
      return { major: String(Math.floor(lb / LB_PER_ST)), minor: String(lb % LB_PER_ST) };
    }
    case "lb":
      return { major: String(Math.round(kg / KG_PER_LB)), minor: "" };
    default:
      return { major: trimZero(kg, 1), minor: "" };
  }
}

/** "72.5 kg", "160 lb", "11 st 6 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const p = weightToParts(kg, unit);
  if (unit === "stlb") return `${p.major} st ${p.minor} lb`;
  return `${p.major} ${unit}`;
}

/** The accepted weight range in the user's unit, rounded inward (see heightBounds). */
export function weightBounds(
  range: { min: number; max: number },
  unit: WeightUnit,
): { min: string; max: string } {
  switch (unit) {
    case "stlb": {
      const lo = Math.ceil(range.min / KG_PER_LB);
      const hi = Math.floor(range.max / KG_PER_LB);
      const f = (lb: number) => `${Math.floor(lb / LB_PER_ST)} st ${lb % LB_PER_ST}`;
      return { min: f(lo), max: f(hi) };
    }
    case "lb":
      return {
        min: String(Math.ceil(range.min / KG_PER_LB)),
        max: `${Math.floor(range.max / KG_PER_LB)} lb`,
      };
    default:
      return { min: String(Math.ceil(range.min)), max: `${Math.floor(range.max)} kg` };
  }
}

// ── Storing what was typed ────────────────────────────────────────────────

/** A height as the bio stores it: whole centimetres. */
export const storedHeight = (cm: number) => Math.round(cm);

/** A weight as the bio stores it: kilograms to one decimal. */
export const storedWeight = (kg: number) => Math.round(kg * 10) / 10;
