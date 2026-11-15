/**
 * App entry.
 *
 * Notification handling is wired BEFORE expo-router loads, at module scope:
 * Android can start this bundle headless (no UI at all) to deliver a
 * lock-screen "Mark as Done" to a background task, and iOS gives a background
 * launch only seconds to handle one. Neither can wait for the router, the fonts
 * or the provider tree. See services/notifications/boot.ts.
 *
 * The home-screen widget is registered here for the same reason: Android
 * starts the bundle headless to draw it. A no-op on a build without the
 * native widget module (see widgets/index.ts).
 */
import "./services/notifications/boot";
import { registerTodayWidget } from "./widgets";
import "expo-router/entry";

registerTodayWidget();
