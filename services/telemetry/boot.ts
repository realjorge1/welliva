/**
 * ANALYTICS BOOT — the platform half, wired once from app/_layout.tsx.
 *
 * Installs the Supabase sink and the app-lifecycle hooks. Separate from
 * ./Analytics so that the pure domain layer can call `track()` without dragging
 * `react-native` into every vitest run — see the header of ./sink.ts.
 *
 * Import this from app code only. Anything under services/ that needs to count
 * something imports `track` from the barrel instead.
 */
import { AppState, type AppStateStatus } from "react-native";

import { flush, persist, setAnalyticsSink, track } from "./Analytics";
import { isAnalyticsConfigured, supabaseSink } from "./supabaseSink";

let subscription: { remove(): void } | null = null;

/**
 * Start counting: one `app_open` now, one per foreground, and a flush when the
 * app goes to the background (the last chance to send before the OS may stop
 * giving us cycles). Returns a teardown; idempotent.
 *
 * Unconditional to call — what it DOES is conditional. With Supabase
 * unconfigured no sink is installed, so events are sanitized and queued and
 * nothing leaves; consent is then checked per event inside `track`.
 */
export function installAnalytics(): () => void {
  if (!isAnalyticsConfigured || subscription) return () => {};

  setAnalyticsSink(supabaseSink);

  track("app_open", { cold: true });
  void flush();

  const onChange = (state: AppStateStatus) => {
    if (state === "active") {
      track("app_open", { cold: false });
      void flush();
    } else if (state === "background") {
      void persist();
      void flush();
    }
  };

  subscription = AppState.addEventListener("change", onChange);

  return () => {
    subscription?.remove();
    subscription = null;
    setAnalyticsSink(null);
  };
}
