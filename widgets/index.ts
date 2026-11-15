/**
 * The home-screen widget's door: register it, and redraw it.
 *
 * EVERYTHING here is off until the native widget module is in the build. The
 * library (react-native-android-widget) looks its native half up with
 * TurboModuleRegistry.getEnforcing the moment it is imported, which THROWS on
 * a build that predates it — the build the owner's phone runs today. So the
 * library and the widget's layout are only ever required inside a function,
 * after `todayWidgetAvailable()` has said yes. On today's build every call
 * here is a quiet no-op; after the next build the widget simply appears in the
 * phone's widget picker.
 *
 * Android only (the owner's decision, 2026-11-14). Free for everyone.
 */
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { todayArtSvg, WIDE_FROM_DP } from "../services/widget/todayArt";
import { factsFor, readTodaySnapshot } from "../services/widget/todaySnapshot";
import { periodOf, wordFor } from "../services/widget/todayWords";

/** The name in app.json's widget config. */
export const TODAY_WIDGET_NAME = "Today";

let available: boolean | null = null;

/** True only on an Android build that contains the native widget module. */
export function todayWidgetAvailable(): boolean {
  if (available != null) return available;
  if (Platform.OS !== "android") return (available = false);
  try {
    available = TurboModuleRegistry.get("AndroidWidget") != null || NativeModules.AndroidWidget != null;
  } catch {
    available = false;
  }
  return available;
}

interface Size {
  width: number;
  height: number;
}

/** Today's widget for one placed widget's size, at this moment. */
async function renderToday(size: Size) {
  const now = new Date();
  const { facts, moments, keptAtMin } = factsFor(await readTodaySnapshot(), now);
  const { word, why } = wordFor(facts);
  const svg = todayArtSvg({
    width: size.width,
    height: size.height,
    moments,
    keptAtMin,
    nowMin: facts.minute,
    period: periodOf(facts.minute),
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TodayWidget } = require("./today/TodayWidget") as typeof import("./today/TodayWidget");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return React.createElement(TodayWidget, { word, why, svg, wide: size.width >= WIDE_FROM_DP });
}

/**
 * Called once from index.js, before the router: Android starts the bundle
 * headless to draw a widget, with no UI at all.
 */
export function registerTodayWidget(): void {
  if (!todayWidgetAvailable()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("react-native-android-widget") as typeof import("react-native-android-widget");
    lib.registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget }) => {
      if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
      try {
        renderWidget(await renderToday(widgetInfo));
      } catch (e) {
        console.log("[widget] could not draw Today", e);
      }
    });
  } catch (e) {
    console.log("[widget] could not register Today", e);
  }
}

/**
 * Redraw every placed Today widget now. The app calls it after writing a new
 * snapshot; with no widget on the home screen it does nothing.
 */
export async function refreshTodayWidget(): Promise<void> {
  if (!todayWidgetAvailable()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("react-native-android-widget") as typeof import("react-native-android-widget");
    await lib.requestWidgetUpdate({
      widgetName: TODAY_WIDGET_NAME,
      renderWidget: (info) => renderToday(info),
    });
  } catch (e) {
    console.log("[widget] could not refresh Today", e);
  }
}

/**
 * What asking to add the widget came to:
 *  · asked       — the launcher showed its own "Add to home screen?" prompt
 *                  (she still chooses there; `todayWidgetPlaced` tells after);
 *  · manual      — this launcher can't add widgets for an app (Android allows
 *                  it from 8.0, but a launcher may not support it): long-press
 *                  the home screen instead;
 *  · unavailable — no widget in this build, or not Android.
 */
export type AddWidgetResult = "asked" | "manual" | "unavailable";

/**
 * Owner, 2026-11-15: "let the app invite users to add the widget to their home
 * screen through a click in settings — just as in Duolingo". Android's own
 * pin request (AppWidgetManager.requestPinAppWidget, via the library).
 */
export async function askToAddTodayWidget(): Promise<AddWidgetResult> {
  if (!todayWidgetAvailable()) return "unavailable";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("react-native-android-widget") as typeof import("react-native-android-widget");
    return (await lib.requestPinWidget({ widgetName: TODAY_WIDGET_NAME })) ? "asked" : "manual";
  } catch (e) {
    console.log("[widget] could not ask to add Today", e);
    return "manual";
  }
}

/** Is at least one Today widget on the home screen? False when it can't be told. */
export async function todayWidgetPlaced(): Promise<boolean> {
  if (!todayWidgetAvailable()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require("react-native-android-widget") as typeof import("react-native-android-widget");
    return (await lib.getWidgetInfo(TODAY_WIDGET_NAME)).length > 0;
  } catch {
    return false;
  }
}
