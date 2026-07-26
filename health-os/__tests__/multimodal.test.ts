import { describe, expect, it } from "vitest";

import { ConsentRepository } from "../privacy/ConsentRepository";
import {
  applyDraftEdit,
  draftsFromAnalysis,
  isAutoChecked,
  mealDraftTotals,
} from "../multimodal/photo";
import { cleanTranscript, looksLikeLog, toVoiceCapture } from "../multimodal/voice";
import {
  MealPhotoSource,
  type ImagePickerProvider,
  type MealPhotoAnalyzer,
} from "../multimodal/MealPhotoSource";
import { SpeechSource, type SpeechProvider } from "../multimodal/SpeechSource";
import type { MealPhotoAnalysis } from "../multimodal/types";
import { MemoryStore } from "./helpers/MemoryStore";

describe("photo drafts (pure)", () => {
  const analysis: MealPhotoAnalysis = {
    slot: "lunch",
    foods: [
      { name: "Grilled chicken", calories: 220, proteinG: 40, confidence: 0.9 },
      { name: "  ", calories: 100 }, // empty → skipped
      { name: "Rice", calories: -50, confidence: 0.3 }, // negative clamped
    ],
  };

  it("normalizes to deterministic drafts, skipping empties and clamping negatives", () => {
    const a = draftsFromAnalysis(analysis, "cap1");
    const b = draftsFromAnalysis(analysis, "cap1");
    expect(a).toEqual(b); // deterministic
    expect(a).toHaveLength(2);
    expect(a[0].id).toBe("photo:cap1:0");
    expect(a[0].slot).toBe("lunch");
    expect(a[1].name).toBe("Rice");
    expect(a[1].calories).toBe(0); // -50 clamped to 0
  });

  it("totals macros and respects the auto-check threshold", () => {
    const drafts = draftsFromAnalysis(analysis, "cap1");
    expect(mealDraftTotals(drafts).proteinG).toBe(40);
    expect(isAutoChecked(drafts[0])).toBe(true); // 0.9
    expect(isAutoChecked(drafts[1])).toBe(false); // 0.3
  });

  it("applies an edit without mutating the source", () => {
    const [d] = draftsFromAnalysis(analysis, "cap1");
    const edited = applyDraftEdit(d, { name: " Chicken thigh ", calories: 250 });
    expect(d.name).toBe("Grilled chicken");
    expect(edited.name).toBe("Chicken thigh");
    expect(edited.calories).toBe(250);
  });
});

describe("voice (pure)", () => {
  it("cleans transcripts", () => {
    expect(cleanTranscript("  had   eggs and a run  ")).toBe("Had eggs and a run");
    expect(cleanTranscript("")).toBe("");
  });

  it("routes logs vs questions", () => {
    expect(looksLikeLog("had eggs and a 5k run")).toBe(true);
    expect(looksLikeLog("what should I eat today?")).toBe(false);
    expect(looksLikeLog("how many calories in rice")).toBe(false);
    expect(toVoiceCapture("drank 500ml of water").looksLikeLog).toBe(true);
  });
});

describe("MealPhotoSource (consent + provider gated)", () => {
  function picker(ready: boolean): ImagePickerProvider {
    return {
      getStatus: async () => ({ permission: ready ? "granted" : "denied", ready }),
      requestAccess: async () => ({ permission: "granted", ready: true }),
      pick: async () => ({ uri: "file://meal.jpg" }),
    };
  }
  const analyzer: MealPhotoAnalyzer = {
    analyze: async () => ({ foods: [{ name: "Eggs", calories: 180, confidence: 0.8 }] }),
  };

  it("returns null without consent", async () => {
    const src = new MealPhotoSource(picker(true), analyzer, new ConsentRepository(new MemoryStore()));
    expect(await src.capture()).toBeNull();
  });

  it("captures + analyzes into drafts once consent + permission are granted", async () => {
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("photo");
    const src = new MealPhotoSource(picker(true), analyzer, consent);
    const cap = await src.capture();
    expect(cap?.drafts).toHaveLength(1);
    expect(cap?.drafts[0].name).toBe("Eggs");
    expect(cap?.drafts[0].source).toBe("photo");
  });

  it("degrades to null when the picker isn't ready", async () => {
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("photo");
    const src = new MealPhotoSource(picker(false), analyzer, consent);
    expect(await src.capture()).toBeNull();
  });
});

describe("SpeechSource (consent + provider gated)", () => {
  const provider: SpeechProvider = {
    getStatus: async () => ({ permission: "granted", ready: true }),
    requestAccess: async () => ({ permission: "granted", ready: true }),
    listen: async () => "had a chicken salad for lunch",
  };

  it("returns null without consent", async () => {
    const src = new SpeechSource(provider, new ConsentRepository(new MemoryStore()));
    expect(await src.capture()).toBeNull();
  });

  it("captures + routes once consent is granted", async () => {
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("voice");
    const src = new SpeechSource(provider, consent);
    const cap = await src.capture();
    expect(cap?.looksLikeLog).toBe(true);
    expect(cap?.text).toMatch(/chicken salad/i);
  });
});
