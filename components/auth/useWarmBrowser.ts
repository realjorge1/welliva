/**
 * Start Chrome before the user asks for it.
 *
 * Every social sign-in is a Chrome Custom Tab. On a phone with a gigabyte of RAM
 * (the TECNO F1 is 970 MB, already swapping) a COLD Chrome takes 10–20 seconds to
 * come up and has been seen to ANR outright — "Input dispatching timed out" in
 * com.android.chrome, then killed — which reads in the app as "sign-in takes
 * forever" and in the tab as "site can't be reached". The network was never the
 * problem: ping to Supabase was 33 ms while it happened.
 *
 * `warmUpAsync` binds the Custom Tabs service, which makes Chrome spin its process
 * up in the background. The user spends those seconds looking at the sign-in sheet
 * instead of at a frozen tab. `coolDownAsync` on the way out lets Chrome go again,
 * so a phone that is short on memory is not asked to keep it alive after sign-in.
 *
 * Android only (iOS has no equivalent), and every failure is swallowed: a phone
 * with no Custom Tabs provider rejects, and that must never reach the sign-in UI.
 */
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";

export function useWarmBrowser(enabled: boolean): void {
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return;
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, [enabled]);
}
