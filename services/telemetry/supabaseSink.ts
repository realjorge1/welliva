/**
 * THE REAL SINK — rows into our own Supabase.
 *
 * This is the only file in services/telemetry that may import `react-native`,
 * `expo-constants` or `lib/supabase`, and it is imported only from ./boot.ts,
 * which is imported only from app/_layout.tsx. Everything upstream of here stays
 * pure so the domain layer keeps testing under Node — see the header of ./sink.ts
 * for what happens when that rule is broken.
 *
 * Two append-only tables, no third party. The anon key the app already ships can
 * INSERT and nothing else; the reporting views are service-role only. See
 * supabase/migrations/20261030120000_analytics.sql.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import type { AnalyticsSink, CrashRow, EventRow, SendResult } from "./sink";

/**
 * Minimal view of the two analytics tables.
 *
 * WHY A CAST AND NOT `Database["public"]["Tables"]`. lib/database.types.ts is
 * GENERATED from the live schema, and CI diffs it against the database. Until the
 * migration has been applied, hand-writing these two tables into that file would
 * be editing generated output — a drift of its own. One documented cast in one
 * module is the honest version. Once the migration is live and the types are
 * regenerated, delete this and use the generated types.
 */
interface AnalyticsTables {
  from(table: "analytics_events" | "crash_reports"): {
    insert(rows: unknown[]): Promise<{ error: { message: string } | null }>;
  };
}

const db = supabase as unknown as AnalyticsTables;

/** Supabase has to be configured for any of this to go anywhere. */
export const isAnalyticsConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabaseSink: AnalyticsSink = {
  platform: Platform.OS,
  appVersion: (Constants.expoConfig?.version as string | undefined) ?? null,

  async sendEvents(rows: EventRow[]): Promise<SendResult> {
    try {
      const { error } = await db.from("analytics_events").insert(rows);
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) {
      // Offline, DNS failure, a paused free-tier project — all the same to us.
      // The queue is kept and the next foreground tries again.
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async sendCrash(row: CrashRow): Promise<SendResult> {
    try {
      const { error } = await db.from("crash_reports").insert([row]);
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
