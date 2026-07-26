/**
 * WELLIVA COACHES — original trainer personas that front the workout library.
 *
 * Purely editorial: a coach is a voice + specialty that gives each workout a
 * human anchor ("led by Rio"). They are original Welliva characters, not
 * likenesses of real trainers, and carry no imagery — the UI renders them as
 * initial-monogram badges in the coach's accent hue.
 */

import type { ArtHue, WorkoutStyle } from "../types";

export interface CoachPersona {
  id: string;
  name: string;
  specialty: string;
  /** The coach's one-line training philosophy. */
  motto: string;
  /** Styles this coach fronts (used for search + filters). */
  styles: WorkoutStyle[];
  hue: ArtHue;
}

export const COACHES: CoachPersona[] = [
  {
    id: "rio",
    name: "Rio",
    specialty: "Cardio & dance energy",
    motto: "If you're smiling, you're still going.",
    styles: ["cardio", "hiit", "endurance"],
    hue: "ember",
  },
  {
    id: "mack",
    name: "Mack",
    specialty: "Foundational strength",
    motto: "Strong is built one honest rep at a time.",
    styles: ["strength", "power"],
    hue: "brand",
  },
  {
    id: "ivy",
    name: "Ivy",
    specialty: "Mobility & recovery",
    motto: "Range is strength you get to keep.",
    styles: ["mobility", "recovery"],
    hue: "teal",
  },
  {
    id: "zane",
    name: "Zane",
    specialty: "High-intensity intervals",
    motto: "Short. Sharp. Yours.",
    styles: ["hiit", "power"],
    hue: "violet",
  },
  {
    id: "dara",
    name: "Dara",
    specialty: "Core & control",
    motto: "Slow it down until it belongs to you.",
    styles: ["core", "endurance"],
    hue: "gold",
  },
];

export function getCoach(id: string): CoachPersona {
  return COACHES.find((c) => c.id === id) ?? COACHES[0];
}
