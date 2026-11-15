/**
 * health-os/multimodal — photo logging (Proactive Companion P5). Voice capture was
 * deleted on 2026-11-15 (owner): it was never built past a consent switch.
 *
 * The capture → analyze → LogDraft → confirm pipeline, as PURE cores plus consent-gated,
 * provider-seam adapters that degrade to a no-op until the native providers (image picker,
 * STT) and the server vision endpoint are registered. The COMMIT step (drafts → live
 * nutrition state + Timeline) is owned by M4 conversation-first logging; everything up to
 * the confirmed draft lives here, ready to plug in.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §4.
 */
export * from "./types";
export {
  CONFIRM_AUTO_CHECK_THRESHOLD,
  applyDraftEdit,
  draftsFromAnalysis,
  isAutoChecked,
  mealDraftTotals,
} from "./photo";
export {
  MealPhotoSource,
  mealPhotoSource,
  nullImagePicker,
  nullMealPhotoAnalyzer,
  type ImagePickerProvider,
  type MealCapture,
  type MealPhotoAnalyzer,
  type PickedImage,
} from "./MealPhotoSource";
