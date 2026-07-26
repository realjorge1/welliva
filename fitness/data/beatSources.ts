/**
 * WELLIVA BEATS — Metro asset map (id → require()).
 *
 * Kept separate from `beatMeta.ts` on purpose: `require()` of .wav files only
 * resolves under Metro, so nothing that runs under vitest/Node may import this
 * file. Only the audio hook (`useBeatPlayer`) touches it.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

export const BEAT_SOURCES: Record<string, number> = {
  "pop-cardio-pulse": require("../../assets/audio/beats/pop-cardio-pulse.wav"),
  "disco-sprint": require("../../assets/audio/beats/disco-sprint.wav"),
  "electro-strength": require("../../assets/audio/beats/electro-strength.wav"),
  "funk-motion": require("../../assets/audio/beats/funk-motion.wav"),
  "synth-run": require("../../assets/audio/beats/synth-run.wav"),
  "house-endurance": require("../../assets/audio/beats/house-endurance.wav"),
  "neon-hiit": require("../../assets/audio/beats/neon-hiit.wav"),
  "bass-boost": require("../../assets/audio/beats/bass-boost.wav"),
  "power-circuit": require("../../assets/audio/beats/power-circuit.wav"),
  "rhythm-climb": require("../../assets/audio/beats/rhythm-climb.wav"),
  "dance-burn": require("../../assets/audio/beats/dance-burn.wav"),
  "victory-drive": require("../../assets/audio/beats/victory-drive.wav"),
  "focus-flow": require("../../assets/audio/beats/focus-flow.wav"),
  "peak-energy": require("../../assets/audio/beats/peak-energy.wav"),
  "cooldown-groove": require("../../assets/audio/beats/cooldown-groove.wav"),
};
