/**
 * region — infer a coarse locality + a sensible default cuisine WITHOUT ever
 * prompting the user.
 *
 * We read the device's IANA time-zone (e.g. "Africa/Lagos", "Europe/Rome")
 * via the built-in `Intl` API — no `expo-location`, no permission dialog, no
 * extra dependency, works offline. The zone's city is a good-enough locality
 * hint to hand the AI meal backend (a city is actually MORE precise than a
 * country), and the continent (plus a small Mediterranean city list) gives a sane
 * starting cuisine the user can override on the food step.
 *
 * Everything is wrapped defensively: on any surface where `Intl` is missing or
 * throws, we simply fall back to no-region / "mixed" and the app behaves exactly
 * as it did before.
 */
import { METRIC_UNITS, type MeasurementUnits } from "@/models/units";
import type { CuisinePreference } from "@/models/user";

export interface DetectedRegion {
  /** Human locality hint (device time-zone city), e.g. "Lagos". Undefined if unknown. */
  region?: string;
  /** Best-guess starting cuisine — always safe, user can change it. */
  cuisine: CuisinePreference;
}

/**
 * Southern-European / Levantine time-zone cities whose home cooking is best
 * served by our "mediterranean" meal set. Everything else in Europe defaults to
 * "western".
 */
const MEDITERRANEAN_CITIES = new Set([
  "Rome",
  "Athens",
  "Madrid",
  "Lisbon",
  "Istanbul",
  "Barcelona",
  "Naples",
  "Malta",
  "Valletta",
  "Nicosia",
  "Tirane",
  "Belgrade",
  "Zagreb",
  "Sarajevo",
  "Podgorica",
  "Skopje",
  "Ljubljana",
]);

const DEFAULT: DetectedRegion = { cuisine: "mixed" };

/** Turn an IANA city token ("New_York") into a display label ("New York"). */
function prettyCity(token: string): string {
  return token.replace(/_/g, " ").trim();
}

/**
 * Detect region + a default cuisine from the device time-zone. Pure, synchronous,
 * never throws — safe to call at render time.
 */
export function detectRegion(): DetectedRegion {
  try {
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    if (!tz || !tz.includes("/")) return DEFAULT;

    const parts = tz.split("/");
    const continent = parts[0];
    const city = prettyCity(parts[parts.length - 1]);

    let cuisine: CuisinePreference = "mixed";
    switch (continent) {
      case "Africa":
        cuisine = "african";
        break;
      case "Europe":
        cuisine = MEDITERRANEAN_CITIES.has(city) ? "mediterranean" : "western";
        break;
      case "America":
        cuisine = "western";
        break;
      // Asia / Australia / Pacific / Atlantic / Indian / Antarctica → "mixed"
      default:
        cuisine = "mixed";
    }

    return { region: city || undefined, cuisine };
  } catch {
    return DEFAULT;
  }
}

/*
 * Measurement units, by the same silent time-zone read.
 *
 * The United States and Canada talk about their bodies in feet, inches and
 * pounds; the UK and Ireland in feet, inches and STONE; Liberia is the other
 * country still on pounds. Everyone else starts metric. This only picks the
 * starting unit — the field's own switch changes it — so a zone missing from
 * these lists costs one tap, never a wrong number.
 */
const US_CANADA_ZONES = new Set([
  // United States
  "America/New_York", "America/Detroit", "America/Chicago", "America/Menominee",
  "America/Denver", "America/Boise", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "America/Juneau", "America/Sitka", "America/Metlakatla",
  "America/Yakutat", "America/Nome", "America/Adak", "Pacific/Honolulu",
  // Canada
  "America/St_Johns", "America/Halifax", "America/Glace_Bay", "America/Moncton",
  "America/Goose_Bay", "America/Toronto", "America/Montreal", "America/Nipigon",
  "America/Thunder_Bay", "America/Iqaluit", "America/Winnipeg", "America/Regina",
  "America/Swift_Current", "America/Edmonton", "America/Vancouver", "America/Whitehorse",
  "America/Dawson", "America/Yellowknife", "America/Cambridge_Bay", "America/Rankin_Inlet",
  "America/Resolute", "America/Atikokan", "America/Creston", "America/Dawson_Creek",
  "America/Fort_Nelson", "America/Inuvik", "America/Rainy_River", "America/Blanc-Sablon",
]);
const US_ZONE_PREFIXES = ["America/Indiana/", "America/Kentucky/", "America/North_Dakota/"];
const STONE_ZONES = new Set([
  "Europe/London", "Europe/Dublin", "Europe/Belfast", "Europe/Isle_of_Man",
  "Europe/Jersey", "Europe/Guernsey",
]);

/** The units a person here most likely uses for their own height and weight. */
export function detectUnits(timeZone?: string): MeasurementUnits {
  try {
    const tz = timeZone ?? Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    if (!tz) return METRIC_UNITS;
    if (US_CANADA_ZONES.has(tz) || US_ZONE_PREFIXES.some((p) => tz.startsWith(p))) {
      return { height: "ftin", weight: "lb" };
    }
    if (STONE_ZONES.has(tz)) return { height: "ftin", weight: "stlb" };
    if (tz === "Africa/Monrovia") return { height: "ftin", weight: "lb" };
    return METRIC_UNITS;
  } catch {
    return METRIC_UNITS;
  }
}
