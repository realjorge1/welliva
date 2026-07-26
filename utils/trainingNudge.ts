/**
 * trainingNudge — remembers when we last offered to set up a training plan for
 * a user who skipped workouts at onboarding, so the offer stays a gentle nudge
 * and never a nag.
 *
 * We only ever SNOOZE (on "maybe later"); accepting flips `trainingEnabled` on
 * the bio, which the caller already gates on — so there's no "accepted" state to
 * store here. Backed by AsyncStorage under one namespaced key; every read/write
 * is defensive so a storage hiccup can never block a session summary.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "welliva.trainingNudge.v1";
/** After a "maybe later", stay quiet for a few days before offering again. */
const SNOOZE_MS = 4 * 24 * 60 * 60 * 1000;

interface NudgeState {
  snoozedAt?: number;
}

async function read(): Promise<NudgeState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NudgeState) : {};
  } catch {
    return {};
  }
}

/** True when we recently offered and the user said "later" — stay quiet. */
export async function isTrainingNudgeSnoozed(): Promise<boolean> {
  const s = await read();
  if (!s.snoozedAt) return false;
  return Date.now() - s.snoozedAt < SNOOZE_MS;
}

/** Record a "maybe later" so we don't ask again for a while. */
export async function snoozeTrainingNudge(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ snoozedAt: Date.now() } satisfies NudgeState));
  } catch {
    // best-effort; worst case we offer once more next session
  }
}
