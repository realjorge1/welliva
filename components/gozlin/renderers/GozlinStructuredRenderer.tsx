/**
 * GozlinStructuredRenderer — central dispatch for any structured coach output
 * attached to a message. Routes by the payload's `__kind` discriminator (mirrors
 * the StructuredMessageRenderer pattern from features/, on Gozlin's own types).
 */

import type { GozlinStructured } from "@/services/gozlin";
import React from "react";
import { BriefingCard } from "./BriefingCard";
import { DetectiveCard } from "./DetectiveCard";
import { ForecastCard } from "./ForecastCard";
import { HabitCard } from "./HabitCard";
import { NutritionAdaptationCard } from "./NutritionAdaptationCard";
import { ProgressCard } from "./ProgressCard";
import { RecoveryCard } from "./RecoveryCard";
import { WeeklyReviewCard } from "./WeeklyReviewCard";
import { WorkoutAdaptationCard } from "./WorkoutAdaptationCard";

export function GozlinStructuredRenderer({ data }: { data?: GozlinStructured }) {
  if (!data) return null;
  switch (data.__kind) {
    case "briefing":
      return <BriefingCard data={data} />;
    case "forecast":
      return <ForecastCard data={data} />;
    case "progress":
      return <ProgressCard data={data} />;
    case "detective":
      return <DetectiveCard data={data} />;
    case "habit":
      return <HabitCard data={data} />;
    case "weekly-review":
      return <WeeklyReviewCard data={data} />;
    case "recovery":
      return <RecoveryCard data={data} />;
    case "workout-adaptation":
      return <WorkoutAdaptationCard data={data} />;
    case "nutrition-adaptation":
      return <NutritionAdaptationCard data={data} />;
    default:
      return null;
  }
}
