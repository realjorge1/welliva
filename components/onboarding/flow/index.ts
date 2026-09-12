/**
 * Welliva onboarding — the presentation layer.
 *
 * Everything in this folder is PRESENTATION. There is no business logic here:
 * no validation bounds, no bio building, no engine calls, no persistence. The
 * step (`app/onboarding.tsx`) owns all of that and hands these components the
 * values and callbacks they need, which is what lets the whole flow be re-cut
 * visually without any risk to what gets saved.
 *
 *   onboardingMotion.ts   durations, easings, distances, Reduce-Motion profile
 *   onboardingTheme.ts    rhythm, surfaces, editorial type
 *   Appear / CrossFade    the entrance + swap primitives everything composes
 *   OnboardingTransition  the two-slot canvas hand-over between steps
 */
export { BreathingPulse, FloatingElement } from "./Ambient";
export { ActivityCard, ActivityDeck, IntensityNodes } from "./ActivityCard";
export {
  Halo,
  IngredientMotif,
  MeasureMotif,
  SafetyMotif,
  WelcomeVisual,
} from "./AmbientWellnessVisual";
export { AnimatedText, ProgressiveText } from "./AnimatedText";
export { AnimatedQuestion, MicroReaction, OPTIONS_DELAY } from "./AnimatedQuestion";
export { Appear, ExitContext, Recede, StaggerReveal } from "./Appear";
export { BuildingAnimation } from "./BuildingAnimation";
export { CinematicExit } from "./CinematicExit";
export { CrossFade } from "./CrossFade";
export { FOOD_QUESTIONS, FoodPreferenceSelector } from "./FoodPreferenceSelector";
export { ChipField, HealthGroup, NoteField, NothingApplies } from "./HealthGroup";
export { InputRow } from "./InputRow";
export { MultiSelectGrid, OptionRail } from "./MultiSelectGrid";
export { cellWidth, gridRows, measureGrid } from "./gridLayout";
export { VITAL_BOX, VITAL_LENGTH, VITAL_PATH } from "./vitalLineGeometry";
export { OnboardingGlyph } from "./OnboardingGlyph";
export {
  OnboardingActions,
  OnboardingContainer,
  StepCentre,
  StepScroll,
} from "./OnboardingContainer";
export { OnboardingHeader } from "./OnboardingHeader";
export { OnboardingProgress } from "./OnboardingProgress";
export { OnboardingTransition } from "./OnboardingTransition";
export { PlanReveal } from "./PlanReveal";
export { SelectionCard, selectHaptic } from "./SelectionCard";
export { DaySelector, TrainingSelector } from "./TrainingSelector";
export { VitalLine } from "./VitalLine";

export { Dur, Ease, Pace, Spring, Stagger, Travel, useMotion } from "./onboardingMotion";
export type { MotionProfile } from "./onboardingMotion";
export {
  Editorial,
  Gutter,
  HAIRLINE,
  HALO,
  HIT,
  MIN_TOUCH,
  Rhythm,
} from "./onboardingTheme";

export type { GlyphName } from "./OnboardingGlyph";
export type { GridOption } from "./MultiSelectGrid";
export type { PlanRevealPreview } from "./PlanReveal";
