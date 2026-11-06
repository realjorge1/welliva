/**
 * THE ANALYTICS SINK — the seam between counting things and sending them.
 *
 * WHY THIS INTERFACE EXISTS AT ALL. `services/*` is deliberately free of React
 * Native imports: the domain layer is pure and storage-port-injected so it runs
 * under plain Node in vitest (see vitest.config.ts and
 * docs/architecture/11-testing-strategy.md). `track()` is called from the middle
 * of that layer — the intake ledger, the water store, the gating module — so the
 * moment Analytics.ts imports `react-native` or `lib/supabase` (which imports
 * `react-native` itself), every test that touches a logging path dies on
 * `Flow is not supported` while parsing react-native/index.js.
 *
 * That is not a mocking problem to paper over; it is the architecture telling us
 * where the boundary goes. So:
 *
 *   Analytics.ts   — pure. Sanitize, queue, consent, activation latch. No RN.
 *   sink.ts        — this file. The shape of "somewhere to send it". No RN.
 *   supabaseSink.ts— the real one: Supabase, Platform, expo-constants.
 *   boot.ts        — installs the sink and the AppState hooks, from _layout.
 *
 * With no sink installed, `track()` still sanitizes and still queues; nothing
 * leaves. That is also exactly what a unit test wants, and why the default is a
 * no-op rather than a throw.
 */

/** One event row, already sanitized, ready to insert. */
export interface EventRow {
  install_id: string;
  user_id: string | null;
  event: string;
  props: Record<string, string | number | boolean>;
  platform: string;
  app_version: string | null;
  occurred_at: string;
}

/** One crash row. Lengths are already capped by CrashLog before it gets here. */
export interface CrashRow {
  install_id: string;
  user_id: string | null;
  surface: string;
  message: string;
  stack: string | null;
  component_stack: string | null;
  platform: string;
  app_version: string | null;
  occurred_at: string;
}

/** What a send attempt says. Never throws — a failed send is data, not an error. */
export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Somewhere for rows to go, plus the two facts about the running app that only
 * the platform layer knows. Implementations must never throw.
 */
export interface AnalyticsSink {
  /** "ios" | "android" | "web" — whatever the host reports. */
  readonly platform: string;
  /** App version string, or null when the host cannot say. */
  readonly appVersion: string | null;
  sendEvents(rows: EventRow[]): Promise<SendResult>;
  sendCrash(row: CrashRow): Promise<SendResult>;
}

/**
 * The default: counts nothing out, drops nothing on the floor loudly. `platform`
 * is "unknown" rather than a guess, so a row written before boot is honest about
 * not knowing instead of claiming to be Android.
 */
export const NULL_SINK: AnalyticsSink = {
  platform: "unknown",
  appVersion: null,
  async sendEvents() {
    return { ok: false, error: "no sink installed" };
  },
  async sendCrash() {
    return { ok: false, error: "no sink installed" };
  },
};
