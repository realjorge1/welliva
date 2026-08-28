/**
 * Welliva motion — the shared motion language + animated primitives.
 *
 *   import { enterFade, enterRise, RollingNumber } from "@/components/motion";
 *
 * All timing derives from `Motion` in constants/theme; all animation runs on
 * the UI thread. Compose these — don't invent per-screen curves.
 */
export {
  Ease,
  enterFade,
  enterHero,
  enterRise,
  exitFade,
  settleLayout,
  tickInDown,
  tickInUp,
  tickOutDown,
  tickOutUp,
} from "./motion";
export { RollingNumber } from "./RollingNumber";
export type { RollingNumberProps } from "./RollingNumber";
export { BreathingGuide } from "./BreathingGuide";
export type { BreathingGuideProps } from "./BreathingGuide";
export { LottiePlayer, isLottieAvailable } from "./LottiePlayer";
export type { LottiePlayerProps } from "./LottiePlayer";
