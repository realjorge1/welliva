/**
 * GOZLIN NLU — language detection for the OFFLINE path only.
 *
 * Online, the model handles other languages natively and this never runs. But
 * offline, a Spanish speaker previously hit the smalltalk fallback and got told
 * their question was "outside my lane" — in English. That reads as broken, not
 * as a limitation.
 *
 * Two cheap signals, in order:
 *   1. Script. Non-Latin script is decisive and needs no word list.
 *   2. Stopword profile. Function words are the highest-frequency, least
 *      topic-dependent tokens in any language, so a couple of hits with zero
 *      English hits is a confident call on a short message.
 *
 * This deliberately does NOT try to identify every language — only enough to
 * apologise in the right one.
 */

export type DetectedLanguage =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ar"
  | "ru"
  | "zh"
  | "ja"
  | "ko"
  | "hi"
  | "other";

const SCRIPTS: [DetectedLanguage, RegExp][] = [
  ["ar", /[؀-ۿ]/],
  ["ru", /[Ѐ-ӿ]/],
  ["hi", /[ऀ-ॿ]/],
  ["ko", /[가-힯]/],
  ["ja", /[぀-ゟ゠-ヿ]/],
  ["zh", /[一-鿿]/],
];

/** Function words. Chosen to be frequent AND not English lookalikes. */
const STOPWORDS: Partial<Record<DetectedLanguage, string[]>> = {
  // "yo" is deliberately absent — it's a Spanish pronoun AND an English
  // greeting, and misfiring on "yo" tells an English speaker we don't speak
  // their language.
  es: ["que", "por", "para", "con", "una", "los", "las", "mi", "estoy", "como", "cuando", "porque", "peso", "quiero", "puedo", "hacer", "perdiendo", "dieta"],
  fr: ["je", "les", "des", "une", "pour", "avec", "mon", "ma", "est", "suis", "pourquoi", "comment", "quand", "poids", "veux"],
  de: ["ich", "und", "der", "die", "das", "nicht", "mit", "ein", "eine", "warum", "wie", "wann", "mein", "gewicht", "will"],
  pt: ["que", "para", "com", "uma", "meu", "minha", "estou", "como", "quando", "porque", "peso", "quero", "nao"],
  it: ["che", "per", "con", "una", "mio", "mia", "sono", "come", "quando", "perche", "peso", "voglio", "non"],
};

/** English function words — their presence vetoes a non-English call. */
const ENGLISH = new Set([
  "the", "and", "is", "am", "are", "was", "my", "i", "you", "what", "why",
  "how", "when", "should", "can", "do", "does", "did", "have", "has", "get",
  "to", "of", "for", "with", "on", "it", "this", "that", "me", "not",
]);

/** A short apology, in their language. Deliberately not a deflection. */
const APOLOGY: Partial<Record<DetectedLanguage, string>> = {
  es: "Ahora mismo solo puedo responder en inglés. Escríbeme en inglés y te ayudo con tu entrenamiento y tu alimentación.",
  fr: "Je ne peux répondre qu'en anglais pour le moment. Écris-moi en anglais et je t'aide pour ton entraînement et ta nutrition.",
  de: "Ich kann im Moment nur auf Englisch antworten. Schreib mir auf Englisch, dann helfe ich dir mit Training und Ernährung.",
  pt: "No momento só consigo responder em inglês. Escreva em inglês e eu ajudo com seu treino e sua alimentação.",
  it: "Al momento posso rispondere solo in inglese. Scrivimi in inglese e ti aiuto con allenamento e alimentazione.",
  ar: "أستطيع الرد بالإنجليزية فقط في الوقت الحالي. راسلني بالإنجليزية وسأساعدك في التمارين والتغذية.",
  ru: "Сейчас я отвечаю только на английском. Напишите на английском — помогу с тренировками и питанием.",
  zh: "我目前只能用英文回复。请用英文告诉我，我来帮你安排训练和饮食。",
  ja: "今は英語でのみ対応できます。英語で書いていただければ、トレーニングと食事のお手伝いをします。",
  ko: "지금은 영어로만 답변할 수 있습니다. 영어로 적어 주시면 운동과 식단을 도와드릴게요.",
  hi: "अभी मैं केवल अंग्रेज़ी में उत्तर दे सकता हूँ। अंग्रेज़ी में लिखें, मैं आपकी ट्रेनिंग और डाइट में मदद करूँगा।",
};

const FALLBACK_APOLOGY =
  "I only work in English right now — send that again in English and I've got you.";

export interface LanguageResult {
  language: DetectedLanguage;
  isEnglish: boolean;
  /** What to say when we can't serve them offline. */
  apology: string;
}

export function detectLanguage(text: string): LanguageResult {
  const t = text.trim();
  if (!t) return { language: "en", isEnglish: true, apology: FALLBACK_APOLOGY };

  // 1. Script — decisive when present.
  for (const [lang, re] of SCRIPTS) {
    if (re.test(t)) {
      return { language: lang, isEnglish: false, apology: APOLOGY[lang] ?? FALLBACK_APOLOGY };
    }
  }

  // 2. Stopword profile, Latin script.
  const tokens = t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // fold accents so "porqué" matches "porque"
    .split(/[^a-z]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return { language: "en", isEnglish: true, apology: FALLBACK_APOLOGY };
  }

  // Any English function word and we treat it as English. Under-calling
  // "non-English" is much cheaper than telling an English speaker we don't
  // speak their language.
  if (tokens.some((w) => ENGLISH.has(w))) {
    return { language: "en", isEnglish: true, apology: FALLBACK_APOLOGY };
  }

  let best: DetectedLanguage = "en";
  let bestHits = 0;
  for (const [lang, words] of Object.entries(STOPWORDS)) {
    const hits = tokens.filter((w) => words!.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = lang as DetectedLanguage;
    }
  }

  // Two hits is a confident call. A single hit only counts on a short-but-not
  // one-word message: "con", "que" and "non" all occur in English text, and a
  // lone token carries no context to disambiguate at all.
  const confident =
    bestHits >= 2 || (bestHits === 1 && tokens.length >= 2 && tokens.length <= 3);
  return confident
    ? { language: best, isEnglish: false, apology: APOLOGY[best] ?? FALLBACK_APOLOGY }
    : { language: "en", isEnglish: true, apology: FALLBACK_APOLOGY };
}
