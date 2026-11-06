/**
 * Gozlin writes in the phone's language — and the checks still hold.
 *
 * The instruction is the easy half. The half that decides whether the feature
 * works at all is the number gate: a German reply writes 1840 as "1.840" and a
 * French one as "1 840", Arabic may use its own digits, and every one of those
 * used to read as some OTHER number — so a correct reply was rejected as
 * invented, regenerated, and dropped to the offline coach in English.
 */

import { describe, expect, it } from "vitest";
import { twinStateMessage, type WireMessage } from "../context";
import { runDeepDive } from "../deepDive";
import { runAgentTurn, type CoachTransport, type CoachTurnRequest } from "../GozlinAgent";
import {
  collectAllowedNumbers,
  extractNumbers,
  maskLocalDates,
  numberSpans,
  validateNumbers,
} from "../grounding";
import { receiptsFor, collectWithProvenance, createLedger } from "../receipts";
import { languageName, normalizeLocaleTag, replyLanguageLines } from "../replyLanguage";
import { safeDisplayLength } from "../streamGate";
import type { GozlinToolContext } from "../tools";

// Invisible and non-Latin characters are built, never typed: an editor shows
// a no-break space as a space and the test would prove nothing.
const NBSP = String.fromCharCode(0x00a0);
const NNBSP = String.fromCharCode(0x202f);
const THIN = String.fromCharCode(0x2009);
const digitsFrom = (zero: number, s: string) =>
  [...s].map((c) => (/\d/.test(c) ? String.fromCharCode(zero + Number(c)) : c)).join("");
const ARABIC = (s: string) => digitsFrom(0x0660, s).replace(".", String.fromCharCode(0x066b));
const PERSIAN = (s: string) => digitsFrom(0x06f0, s);
const DEVANAGARI = (s: string) => digitsFrom(0x0966, s);
const BENGALI = (s: string) => digitsFrom(0x09e6, s);

describe("reading the phone's language", () => {
  it("turns Android's and iOS's locale ids into one tag", () => {
    expect(normalizeLocaleTag("fr_FR")).toBe("fr-FR");
    expect(normalizeLocaleTag("fr-FR")).toBe("fr-FR");
    expect(normalizeLocaleTag("yo_NG")).toBe("yo-NG");
    expect(normalizeLocaleTag("zh_CN_#Hans")).toBe("zh-Hans-CN");
    expect(normalizeLocaleTag("zh-Hant-TW")).toBe("zh-Hant-TW");
    expect(normalizeLocaleTag("sr_RS_#Latn")).toBe("sr-Latn-RS");
    expect(normalizeLocaleTag("es-419")).toBe("es-419");
    expect(normalizeLocaleTag("en")).toBe("en");
  });

  it("maps the three languages Android still reports by their old codes", () => {
    expect(normalizeLocaleTag("iw_IL")).toBe("he-IL");
    expect(normalizeLocaleTag("in_ID")).toBe("id-ID");
    expect(normalizeLocaleTag("ji")).toBe("yi");
  });

  it("drops extensions, which say how numbers render, not what someone reads", () => {
    expect(normalizeLocaleTag("th_TH_TH_#u-nu-thai")).toBe("th-TH");
    expect(normalizeLocaleTag("ar-EG-u-nu-arab")).toBe("ar-EG");
  });

  it("returns null for anything that is not a language", () => {
    for (const id of [null, undefined, "", "C", "POSIX", "und", "12_34"]) {
      expect(normalizeLocaleTag(id), String(id)).toBeNull();
    }
  });

  it("names Chinese by the script the reader actually uses", () => {
    expect(languageName("zh-Hant-TW")).toBe("Chinese (Traditional)");
    expect(languageName("zh-HK")).toBe("Chinese (Traditional)");
    expect(languageName("zh-Hans-CN")).toBe("Chinese (Simplified)");
    expect(languageName("zh")).toBe("Chinese (Simplified)");
  });

  it("names the languages of the people this app is for", () => {
    expect(languageName("yo-NG")).toBe("Yoruba");
    expect(languageName("ig-NG")).toBe("Igbo");
    expect(languageName("ha-NG")).toBe("Hausa");
    expect(languageName("sw-KE")).toBe("Swahili");
    expect(languageName("am-ET")).toBe("Amharic");
    expect(languageName("hi-IN")).toBe("Hindi");
    expect(languageName("xx-YY")).toBe("the language of the locale xx-YY");
  });
});

describe("the instruction", () => {
  it("is not there at all for an English phone, or one we could not read", () => {
    for (const tag of ["en", "en-GB", "en-US", "en-NG", null, undefined]) {
      expect(replyLanguageLines(tag), String(tag)).toEqual([]);
    }
  });

  it("names the language and the tag, and says why English messages don't count", () => {
    const text = replyLanguageLines("fr-FR").join("\n");
    expect(text).toContain("their phone is set to French (fr-FR). Write your reply in French.");
    expect(text).toContain("suggestion buttons send English prompts");
    expect(text).toContain("neither English nor French");
  });

  it("keeps the app's names findable and the numbers checkable", () => {
    const text = replyLanguageLines("de-DE").join("\n");
    expect(text).toContain("exactly as the app shows them, untranslated");
    expect(text).toContain("no thousands separator: 1840");
  });
});

const TWIN = {
  asOf: "2026-09-27",
  identitySummary: "losing fat",
  flags: [],
  goal: "lose_weight",
  today: {
    calories: { consumed: 1840, target: 2200, pct: 0.84 },
    protein: { consumed: 96, target: 150, pct: 0.64 },
    water: { consumed: 1200, target: 2500, pct: 0.48 },
    workout: { planned: "Upper body", done: false, minutes: 40 },
    dayProgress: 0.5,
  },
  momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
  recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
} as never;

const NO_ONE = { preferences: [], constraints: [], updatedAt: 0 };

describe("the state block carries it", () => {
  const state = (language?: string) =>
    String(twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity: NO_ONE, language }).content);

  it("as the last thing in the block — form, after every fact and rule", () => {
    const text = state("pt-BR");
    expect(text).toContain("LANGUAGE — their phone is set to Portuguese (pt-BR).");
    expect(text.trimEnd().endsWith("not 1.840 or 1 840.")).toBe(true);
  });

  it("and leaves an English or unknown phone's block exactly as it was", () => {
    expect(state("en-GB")).toBe(state(undefined));
    expect(state(undefined)).not.toContain("LANGUAGE");
  });
});

describe("numbers as the rest of the world writes them", () => {
  it("reads typographic thousands marks as one figure", () => {
    expect(extractNumbers(`1${NBSP}840 kcal`)).toEqual([1840]);
    expect(extractNumbers(`1${NNBSP}840 kcal`)).toEqual([1840]);
    expect(extractNumbers(`12${THIN}500 pas`)).toEqual([12500]);
    expect(extractNumbers("1'840 kcal")).toEqual([1840]);
    expect(extractNumbers(`1${NBSP}840,5 kcal`)).toEqual([1840.5]);
  });

  it("reads dot groups and a decimal comma", () => {
    expect(extractNumbers("1.840,5 kcal")).toEqual([1840.5]);
    expect(extractNumbers("1.840.000 Schritte")).toEqual([1840000]);
    expect(extractNumbers("82,6 kg")).toEqual([82.6]);
    expect(extractNumbers("0,45 kg par semaine")).toEqual([0.45]);
    expect(extractNumbers("0,125 kg")).toEqual([0.125]);
  });

  it("still reads English the English way", () => {
    expect(extractNumbers("1,840 of 2,200")).toEqual([1840, 2200]);
    expect(extractNumbers("12,500.5 steps")).toEqual([12500.5]);
    expect(extractNumbers("82.6 kg")).toEqual([82.6]);
  });

  it("keeps BOTH readings of the one ambiguous shape", () => {
    const [de] = numberSpans("1.840 kcal");
    expect(de.value).toBe(1.84);
    expect(de.alt).toBe(1840);
    const [en] = numberSpans("1,840 kcal");
    expect(en.value).toBe(1840);
    expect(en.alt).toBe(1.84);
  });

  it("never mistakes a list or a plain space for a figure", () => {
    expect(extractNumbers("sets of 3,4,5")).toEqual([3, 4, 5]);
    expect(extractNumbers("3 100g servings")).toEqual([3, 100]);
  });

  it("reads digits in other scripts, where they used to slip past unchecked", () => {
    expect(extractNumbers(ARABIC("1840"))).toEqual([1840]);
    expect(extractNumbers(ARABIC("82.6"))).toEqual([82.6]);
    expect(extractNumbers(PERSIAN("1840"))).toEqual([1840]);
    expect(extractNumbers(DEVANAGARI("1840"))).toEqual([1840]);
    expect(extractNumbers(BENGALI("2200"))).toEqual([2200]);
  });

  it("reports positions in the text as written", () => {
    const text = `Tu es à 1${NNBSP}840 sur ${ARABIC("2200")}.`;
    const spans = numberSpans(text);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual([`1${NNBSP}840`, ARABIC("2200")]);
  });

  it("does not count Chinese, Japanese and Korean dates, or a French clock", () => {
    expect(extractNumbers("2026年9月12日")).toEqual([]);
    expect(extractNumbers("9월 12일")).toEqual([]);
    expect(extractNumbers("2026년")).toEqual([]);
    expect(extractNumbers("à 19h30")).toEqual([]);
  });
});

describe("the gate, in other languages", () => {
  const allowed = collectAllowedNumbers({ consumed: 1840, target: 2200, weight: 82.6, rate: -0.45 });

  it("passes the real figures however they are written", () => {
    for (const reply of [
      "Du liegst bei 1.840 von 2.200 kcal.",
      `Tu es à 1${NNBSP}840 sur 2${NNBSP}200 kcal.`,
      "Estás en 1840 de 2200 kcal.",
      "Pesas 82,6 kg y bajas 0,45 kg por semana.",
      `${ARABIC("1840")} من ${ARABIC("2200")}`,
    ]) {
      expect(validateNumbers(reply, allowed).ok, reply).toBe(true);
    }
  });

  it("still catches an invented figure in every one of those forms", () => {
    for (const reply of [
      "Du bist 1.340 kcal drüber.",
      `Tu as 1${NNBSP}340 kcal de trop.`,
      "Pesas 81,2 kg.",
      `${ARABIC("1340")} سعرة`,
    ]) {
      expect(validateNumbers(reply, allowed).ok, reply).toBe(false);
    }
  });

  it("gives the receipt the reading the evidence backs", () => {
    const ledger = createLedger();
    collectWithProvenance({ today: { calories: 1840 } }, "current-state", ledger);
    expect(receiptsFor("Du liegst bei 1.840 kcal.", ledger).map((r) => r.shown)).toEqual([1840]);
  });

  it("holds back a figure whose next group may still be arriving", () => {
    const draft = `Tu es à 1${NBSP}`;
    expect(safeDisplayLength(draft, allowed)).toBe(draft.indexOf("1"));
  });
});

describe("dates written with a month name", () => {
  const masked = (text: string, lang: string) => extractNumbers(maskLocalDates(text, lang));

  it("are not claims, in the reply's own language", () => {
    expect(masked("le 12 septembre, tu as dit", "fr-FR")).toEqual([]);
    expect(masked("am 12. September 2026 hast du gesagt", "de-DE")).toEqual([]);
    expect(masked("el 12 de septiembre de 2026 dijiste", "es-ES")).toEqual([]);
    expect(masked("в 12 сентября ты сказал", "ru-RU")).toEqual([]);
    expect(masked("a 12 settembre", "it-IT")).toEqual([]);
    expect(masked("ranar Satumba 12", "ha-NG")).toEqual([]);
    expect(masked("tarehe 12 Septemba", "sw-KE")).toEqual([]);
    expect(masked("ngày 12 tháng 9", "vi-VN")).toEqual([]);
  });

  it("without hiding a claim that merely stands near a month", () => {
    expect(masked("en septembre, 45 séances", "fr-FR")).toEqual([45]);
    expect(masked("12 séances ce mois-ci", "fr-FR")).toEqual([12]);
    expect(masked("1824 septembre", "fr-FR")).toEqual([1824]);
    expect(masked("le 12 septembre, 2000 kcal", "fr-FR")).toEqual([2000]);
    // Italian "set" is a month AND a set of an exercise; only the full name counts.
    expect(masked("fai 12 set", "it-IT")).toEqual([12]);
  });

  it("keeps every position where it was", () => {
    const text = "le 12 septembre, 1840 kcal";
    expect(maskLocalDates(text, "fr-FR")).toHaveLength(text.length);
    expect(maskLocalDates(text, "fr-FR").indexOf("1840")).toBe(text.indexOf("1840"));
  });

  it("leaves English to the English rules, and an unknown phone alone", () => {
    expect(maskLocalDates("on 12 September", "en-GB")).toBe("on 12 September");
    expect(maskLocalDates("le 12 septembre", undefined)).toBe("le 12 septembre");
  });
});

// ── End to end ─────────────────────────────────────────────────────────────

function context(over: Partial<GozlinToolContext> = {}): GozlinToolContext {
  return {
    twin: TWIN,
    snapshot: { bio: null } as never,
    insights: [] as never,
    identity: NO_ONE,
    checkins: [],
    conversation: [],
    weekStart: "2026-09-21",
    weeklyWorkoutTarget: 3,
    now: new Date("2026-09-27T12:00:00"),
    ...over,
  } as GozlinToolContext;
}

function scripted(replies: string[]): { transport: CoachTransport; calls: CoachTurnRequest[] } {
  const calls: CoachTurnRequest[] = [];
  const transport: CoachTransport = async (req) => {
    calls.push({ ...req, messages: [...req.messages] });
    const text = replies[Math.min(calls.length - 1, replies.length - 1)];
    return { content: [{ type: "text", text }], stop_reason: "end_turn" };
  };
  return { transport, calls };
}

const lastSystem = (messages: WireMessage[]) =>
  String([...messages].reverse().find((m) => m.role === "system")?.content ?? "");

describe("a turn on a French phone", () => {
  it("tells the model, and ships a French reply with French numbers on the first draft", async () => {
    const { transport, calls } = scripted([
      `Tu es à 1${NNBSP}840 kcal sur 2${NNBSP}200 — il reste de la marge pour le dîner.`,
    ]);
    const r = await runAgentTurn("how am I doing on calories?", context({ language: "fr-FR" }), {
      transport,
    });
    expect(lastSystem(calls[0].messages)).toContain("Write your reply in French.");
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
    expect((r.message.receipts ?? []).map((x) => x.shown)).toEqual([1840, 2200]);
  });

  it("lets a dated memory through, as English already could", async () => {
    const { transport, calls } = scripted(["Le 23 septembre, tu étais à 1840 kcal."]);
    const r = await runAgentTurn("et la semaine dernière ?", context({ language: "fr-FR" }), {
      transport,
    });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
  });

  it("still regenerates an invented figure", async () => {
    const { transport, calls } = scripted([
      "Le 23 septembre, tu étais 1.340 kcal au-dessus.",
      "Tu es à 1840 kcal aujourd'hui.",
    ]);
    const r = await runAgentTurn("et hier ?", context({ language: "fr-FR" }), { transport });
    expect(calls).toHaveLength(2);
    expect(r.message.content).toBe("Tu es à 1840 kcal aujourd'hui.");
  });

  it("asks for the deep dive in French too", async () => {
    const { transport, calls } = scripted(["## Pourquoi\nLes protéines…"]);
    const res = await runDeepDive(
      {
        question: "why protein?",
        answer: "Protein holds muscle.",
        twin: TWIN,
        context: { snapshot: { bio: null } as never, identity: NO_ONE, language: "fr-FR" },
      },
      { transport },
    );
    expect(res.ok).toBe(true);
    expect(lastSystem(calls[0].messages)).toContain("Write your reply in French.");
  });
});
