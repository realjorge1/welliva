/**
 * skiaSafe — load @shopify/react-native-skia without ever crashing the app.
 *
 * Skia is a native module. In a development build (`expo run:android`) it's
 * present; but if the JS bundle is reloaded before the native side is rebuilt
 * — or on any surface where Skia isn't linked — a bare import would throw at
 * module-eval and white-screen the route. We require it defensively once and
 * expose an availability flag; every Skia component pairs with a plain
 * react-native-svg fallback so there's always *something* on screen.
 */
type SkiaModule = typeof import("@shopify/react-native-skia");

let mod: SkiaModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require("@shopify/react-native-skia") as SkiaModule;
} catch {
  mod = null;
}

export const SkiaMod: SkiaModule | null = mod;
export const isSkiaAvailable: boolean = !!mod && typeof mod.Canvas !== "undefined";
