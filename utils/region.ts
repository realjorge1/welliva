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
