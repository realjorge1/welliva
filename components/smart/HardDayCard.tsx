/**
 * HardDayCard — "Thursdays are your toughest: you missed 4 of the last 5 planned
 * workouts on a Thursday. Want a 15-minute Thursday?", and, four weeks later,
 * the same card asking whether to keep it, with the real number.
 *
 * Words from services/smart/hardDay; answers from useHardDayMoment.
 */
import { hardDayCopy, reviewCopy, type HardDayOffer, type ShortReview } from "@/services/smart";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SmartCard } from "./SmartCard";

export function HardDayCard({
  moment,
  onAccept,
  onDecline,
  style,
}: {
  moment: HardDayOffer | ShortReview;
  onAccept: (m: HardDayOffer | ShortReview) => void;
  onDecline: (m: HardDayOffer | ShortReview) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const copy = moment.kind === "offer" ? hardDayCopy(moment) : reviewCopy(moment);
  return (
    <SmartCard
      icon="calendar-outline"
      message={copy.message}
      source={copy.source}
      primary={{ label: copy.accept, onPress: () => onAccept(moment) }}
      secondary={{ label: copy.decline, onPress: () => onDecline(moment) }}
      style={style}
    />
  );
}
