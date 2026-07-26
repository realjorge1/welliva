/**
 * haptics — app-wide tactile feedback switch.
 *
 * Drop-in shim for the subset of `expo-haptics` the app uses. Currently a
 * no-op: the team disabled all press/selection vibrations (they read as a
 * "subtle buzz" on every tap). Flip `HAPTICS_ENABLED` to true to restore the
 * real haptics in one place, with zero changes at the call sites.
 */
import * as Expo from "expo-haptics";

/** Master switch. Off = no vibrations anywhere. */
export const HAPTICS_ENABLED = false;

export const ImpactFeedbackStyle = Expo.ImpactFeedbackStyle;
export const NotificationFeedbackType = Expo.NotificationFeedbackType;

export function impactAsync(style?: Expo.ImpactFeedbackStyle): Promise<void> {
  if (!HAPTICS_ENABLED) return Promise.resolve();
  return Expo.impactAsync(style);
}

export function notificationAsync(
  type?: Expo.NotificationFeedbackType,
): Promise<void> {
  if (!HAPTICS_ENABLED) return Promise.resolve();
  return Expo.notificationAsync(type);
}

export function selectionAsync(): Promise<void> {
  if (!HAPTICS_ENABLED) return Promise.resolve();
  return Expo.selectionAsync();
}
