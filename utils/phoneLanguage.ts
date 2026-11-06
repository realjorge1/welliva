/**
 * phoneLanguage — the language the phone is set to, read WITHOUT asking.
 *
 * Gozlin writes its replies in it (services/gozlin/agent/replyLanguage.ts).
 *
 * Android hands it over as the app's resource locale (I18nManager's
 * `localeIdentifier`, "fr_FR"), which also follows a per-app language picked
 * in Android settings. iOS doesn't export that, but its user defaults carry
 * the person's ordered languages (`AppleLanguages`, ["fr-FR", "en-GB"]),
 * per-app choice included. `Intl`'s default locale is the last resort.
 *
 * All of it is core React Native, so this works in the build already on the
 * phone — no native module was added for it. Never throws; null means "don't
 * know", which the coach treats exactly like English.
 */
import { normalizeLocaleTag } from "@/services/gozlin/agent/replyLanguage";
import { I18nManager, Platform, Settings } from "react-native";

/** Read once: the platform values are themselves snapshots taken at launch. */
let cached: string | null | undefined;

export function phoneLanguage(): string | null {
  if (cached === undefined) cached = read();
  return cached;
}

function read(): string | null {
  try {
    if (Platform.OS === "ios") {
      const list: unknown = Settings.get("AppleLanguages");
      const first = Array.isArray(list) ? list[0] : list;
      const tag = normalizeLocaleTag(typeof first === "string" ? first : null);
      if (tag) return tag;
    } else if (Platform.OS === "android") {
      const tag = normalizeLocaleTag(I18nManager.getConstants().localeIdentifier);
      if (tag) return tag;
    }
  } catch {
    // A missing native module reads as "don't know" — fall through.
  }
  try {
    return normalizeLocaleTag(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return null;
  }
}
