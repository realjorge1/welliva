/**
 * health-os/multimodal/MealPhotoSource.ts
 *
 * The meal-photo capture path: pick/snap an image (ImagePickerProvider seam) → analyze it
 * (MealPhotoAnalyzer seam, the server `/v1/log/photo` vision endpoint) → normalized
 * `LogDraft[]` for a confirm card. Consent-gated on "photo"; degrades to a safe no-op when
 * no provider is registered (Expo Go / web / endpoint absent).
 *
 * Both seams default to null implementations so this builds and runs today; the real
 * `expo-image-picker` provider + the vision endpoint are the EAS-build / M4 cutover.
 * See docs/companion/00-proactive-companion-blueprint.md §3.2 + §4 (P5).
 */
import { consent as defaultConsent, type ConsentRepository } from "../privacy";
import type { SignalStatus } from "../signals/types";
import { draftsFromAnalysis } from "./photo";
import type { LogDraft, MealPhotoAnalysis } from "./types";

export interface PickedImage {
  uri: string;
  /** Base64 (sent to the analyzer); absent when the provider can't supply it. */
  base64?: string;
}

/** Device image source (camera roll / camera). The `expo-image-picker` adapter implements this. */
export interface ImagePickerProvider {
  getStatus(): Promise<SignalStatus>;
  requestAccess(): Promise<SignalStatus>;
  pick(opts: { camera?: boolean }): Promise<PickedImage | null>;
}

/** Vision analysis seam (server `/v1/log/photo`). Returns null when unavailable. */
export interface MealPhotoAnalyzer {
  analyze(image: PickedImage): Promise<MealPhotoAnalysis | null>;
}

export const nullImagePicker: ImagePickerProvider = {
  getStatus: async () => ({ permission: "unavailable", ready: false }),
  requestAccess: async () => ({ permission: "unavailable", ready: false }),
  pick: async () => null,
};

export const nullMealPhotoAnalyzer: MealPhotoAnalyzer = {
  analyze: async () => null,
};

export interface MealCapture {
  image: PickedImage;
  analysis: MealPhotoAnalysis;
  drafts: LogDraft[];
}

/** A small stable id for a capture (seeds deterministic draft ids → idempotent commit). */
function captureId(image: PickedImage, now: Date): string {
  const basis = image.uri || String(now.getTime());
  let h = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export class MealPhotoSource {
  constructor(
    private readonly picker: ImagePickerProvider = nullImagePicker,
    private readonly analyzer: MealPhotoAnalyzer = nullMealPhotoAnalyzer,
    private readonly consent: ConsentRepository = defaultConsent,
  ) {}

  getStatus(): Promise<SignalStatus> {
    return this.picker.getStatus();
  }

  async requestAccess(): Promise<SignalStatus> {
    await this.consent.grant("photo");
    return this.picker.requestAccess();
  }

  /**
   * Capture + analyze a meal photo into confirmable drafts. Returns null when consent is
   * absent, the picker is unavailable, the user cancels, or analysis yields nothing —
   * never throws into the UI. Nothing is logged here; the caller confirms first.
   */
  async capture(opts: { camera?: boolean; now?: Date } = {}): Promise<MealCapture | null> {
    if (!(await this.consent.isGranted("photo"))) return null;
    try {
      const status = await this.picker.getStatus();
      if (!status.ready) return null;
      const image = await this.picker.pick({ camera: opts.camera });
      if (!image) return null;
      const analysis = await this.analyzer.analyze(image);
      if (!analysis || (analysis.foods ?? []).length === 0) return null;
      const drafts = draftsFromAnalysis(analysis, captureId(image, opts.now ?? new Date()));
      if (drafts.length === 0) return null;
      return { image, analysis, drafts };
    } catch {
      return null;
    }
  }
}

/** The default, app-wide meal-photo source (real providers registered in the dev build). */
export const mealPhotoSource = new MealPhotoSource();
