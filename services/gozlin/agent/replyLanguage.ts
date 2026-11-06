/**
 * GOZLIN AGENT — the language Gozlin writes in.
 *
 * The app's screens are English and stay English. What follows the phone's
 * language is Gozlin's own writing — the chat replies and the deep dive —
 * because the model writes those fresh every time, so writing them in French
 * costs nothing that writing them in English didn't. No string table, no
 * translated copy shipped in the app, nothing to keep in step.
 *
 * The rule handed to the model, and why each clause is there:
 *
 *  - Write in the phone's language EVEN WHEN THE MESSAGE IS ENGLISH. The
 *    suggestion buttons send English prompts on the person's behalf, so a
 *    coach that mirrored the message would answer every chip tap in English.
 *  - Switch when they ask, or when they write in a third language. Someone
 *    whose phone is in French and who writes to us in Yoruba has told us
 *    something the phone setting can't.
 *  - Keep names as the app shows them. The exercise library, the food log and
 *    the habit tracker are in English (habits in the person's own words); a
 *    coach that translates "Bulgarian Split Squat" sends them looking for
 *    something no screen in the app calls by that name.
 *  - Digits 0-9, no thousands separator. Every figure in a reply is checked
 *    against their logs before it is shown (./grounding.ts), and "1 840" and
 *    "1.840" are how much of the world writes 1840. The checker reads the
 *    common forms anyway; asking for plain digits keeps the check exact
 *    rather than lucky.
 *
 * An English phone gets no line at all. The model already answers in the
 * language it is written to, and that is the behaviour those people keep.
 */

/** Android still reports three languages by their pre-1989 codes. */
const LEGACY_CODES: Record<string, string> = { iw: "he", in: "id", ji: "yi" };

/** English names, so the instruction reads as a sentence and not as a code. */
const LANGUAGE_NAMES: Record<string, string> = {
  // Africa
  af: "Afrikaans", ak: "Akan", am: "Amharic", ee: "Ewe", ff: "Fula", ha: "Hausa", ig: "Igbo",
  ki: "Kikuyu", lg: "Luganda", ln: "Lingala", mg: "Malagasy", ny: "Chichewa", om: "Oromo",
  pcm: "Nigerian Pidgin", rn: "Kirundi", rw: "Kinyarwanda", sn: "Shona", so: "Somali",
  st: "Sesotho", sw: "Swahili", ti: "Tigrinya", tn: "Setswana", tw: "Twi", wo: "Wolof",
  xh: "Xhosa", yo: "Yoruba", zu: "Zulu",
  // The Middle East and Central Asia
  ar: "Arabic", az: "Azerbaijani", fa: "Persian", he: "Hebrew", hy: "Armenian", ka: "Georgian",
  kk: "Kazakh", ku: "Kurdish", ky: "Kyrgyz", ps: "Pashto", tg: "Tajik", tk: "Turkmen",
  tr: "Turkish", ur: "Urdu", uz: "Uzbek", yi: "Yiddish",
  // South Asia
  as: "Assamese", bn: "Bengali", gu: "Gujarati", hi: "Hindi", kn: "Kannada", ml: "Malayalam",
  mr: "Marathi", ne: "Nepali", or: "Odia", pa: "Punjabi", si: "Sinhala", ta: "Tamil", te: "Telugu",
  // East and South-East Asia
  fil: "Filipino", id: "Indonesian", ja: "Japanese", jv: "Javanese", km: "Khmer", ko: "Korean",
  lo: "Lao", mn: "Mongolian", ms: "Malay", my: "Burmese", th: "Thai", tl: "Filipino",
  vi: "Vietnamese", zh: "Chinese",
  // Europe
  be: "Belarusian", bg: "Bulgarian", bs: "Bosnian", ca: "Catalan", cs: "Czech", cy: "Welsh",
  da: "Danish", de: "German", el: "Greek", es: "Spanish", et: "Estonian", eu: "Basque",
  fi: "Finnish", fr: "French", ga: "Irish", gl: "Galician", hr: "Croatian", hu: "Hungarian",
  is: "Icelandic", it: "Italian", lb: "Luxembourgish", lt: "Lithuanian", lv: "Latvian",
  mk: "Macedonian", mt: "Maltese", nb: "Norwegian", nl: "Dutch", nn: "Norwegian (Nynorsk)",
  no: "Norwegian", pl: "Polish", pt: "Portuguese", ro: "Romanian", ru: "Russian", sk: "Slovak",
  sl: "Slovenian", sq: "Albanian", sr: "Serbian", sv: "Swedish", uk: "Ukrainian",
};

/**
 * A platform locale id as a BCP 47 tag.
 *
 * Android hands over Java's form ("fr_FR", "zh_CN_#Hans", the legacy "iw_IL"),
 * iOS the standard one ("fr-FR", "zh-Hans-CN"); both come out as "fr-FR",
 * "zh-Hans-CN", "he-IL". Extensions ("-u-nu-arab") are dropped — they describe
 * how numbers and calendars render, not which language someone reads. Null
 * for anything that does not start with a language.
 */
export function normalizeLocaleTag(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const parts = id.trim().replace(/#/g, "").split(/[-_]+/).filter(Boolean);
  const first = parts[0]?.toLowerCase();
  if (!first || !/^[a-z]{2,3}$/.test(first) || first === "und") return null;

  const lang = LEGACY_CODES[first] ?? first;
  let script: string | undefined;
  let region: string | undefined;
  for (const p of parts.slice(1)) {
    if (p.length === 1) break; // a singleton opens an extension
    if (!script && /^[A-Za-z]{4}$/.test(p)) script = p[0].toUpperCase() + p.slice(1).toLowerCase();
    else if (!region && (/^[A-Za-z]{2}$/.test(p) || /^\d{3}$/.test(p))) region = p.toUpperCase();
  }
  return [lang, script, region].filter(Boolean).join("-");
}

/** The language subtag of a tag: "fr" for "fr-FR". */
export function languageOf(tag: string): string {
  return tag.split("-")[0].toLowerCase();
}

/**
 * What to call the language in the instruction. Chinese is the one case where
 * the tag decides between two written forms, and getting it wrong hands
 * someone in Taipei a reply in characters they don't use.
 */
export function languageName(tag: string): string {
  const [, ...rest] = tag.split("-");
  const lang = languageOf(tag);
  if (lang === "zh") {
    const script = rest.find((s) => s.length === 4);
    const region = rest.find((s) => s.length === 2);
    const traditional =
      script === "Hant" || (!script && (region === "TW" || region === "HK" || region === "MO"));
    return traditional ? "Chinese (Traditional)" : "Chinese (Simplified)";
  }
  return LANGUAGE_NAMES[lang] ?? `the language of the locale ${tag}`;
}

/**
 * The language half of the state block. Empty for English and for a phone
 * whose language could not be read, which leaves those turns exactly as they
 * were.
 *
 * The tag rides along with the name because the region is information the name
 * drops: pt-BR and pt-PT, es-MX and es-ES, fr-CA and fr-FR are different
 * readers.
 */
export function replyLanguageLines(tag?: string | null): string[] {
  if (!tag || languageOf(tag) === "en") return [];
  const name = languageName(tag);
  return [
    "",
    `LANGUAGE — their phone is set to ${name} (${tag}). Write your reply in ${name}.`,
    `- Their messages may arrive in English: the app's suggestion buttons send English prompts for them, and that is not a request for English. Change language only if they ask you to, or if they write to you in a language that is neither English nor ${name} — then answer in theirs.`,
    "- Keep the names of exercises, foods, habits and app screens exactly as the app shows them, untranslated, so they can find them.",
    "- Write every number in the digits 0-9 with no thousands separator: 1840, not 1.840 or 1 840.",
  ];
}
