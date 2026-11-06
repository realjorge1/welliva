/**
 * CRASH LOG — the local black box for render crashes.
 *
 * Sibling to services/sync/SyncTelemetry: same discipline, different failure
 * domain. A React render throw used to leave NOTHING behind — the user saw a
 * white screen, force-quit, and we learned nothing. Now every crash caught by
 * an <AppErrorBoundary> lands here first.
 *
 * We record the SURFACE that broke, the error message and the component stack —
 * never field values. A message can technically carry a value a throw site
 * interpolated, which is why `truncate` caps it: enough to debug, not enough to
 * be a data export.
 *
 * THIS LOG IS LOCAL. A COPY NOW LEAVES, IF THE USER LET IT (changed 30 Oct 2026).
 * The ring buffer below is still the device-local black box, and still the thing a
 * debug screen reads. But a local-only crash log answers "why did it break on MY
 * phone" and never "how often does this break for everyone", and an app shipping
 * with the second question unanswerable is how a crash on a device you don't own
 * stays invisible forever. So `reportCrash` also hands the record to
 * Analytics.uploadCrash, which:
 *   - sends to OUR Supabase `crash_reports`, never a third-party crash service
 *     (constants/legal.ts promises no third-party analytics, and that holds);
 *   - sends only if `crash_diagnostics` consent is granted, checked per crash;
 *   - fails silently, because this runs while the app is already broken.
 * Writing the local record NEVER depends on the upload — see the ordering below.
 *
 * Fail-soft, absolutely: this module runs while the app is already broken. Every
 * path swallows its own errors. A crash logger that throws is worse than none.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { uploadCrash } from "./Analytics";

/** Device-local by nature — see DEVICE_LOCAL_KEYS in services/sync/syncKeys. */
export const CRASH_LOG_KEY = "@welliva_crash_log";

/** Small: this sits in AsyncStorage on a phone, next to real user data. */
const MAX_CRASHES = 20;
/** Long enough to identify the throw, short enough not to be an exfil channel. */
const MAX_MESSAGE = 300;
const MAX_STACK = 2000;

export interface CrashRecord {
  /** Which boundary caught it: "root" | "navigation" | "tab:diet" | … */
  surface: string;
  message: string;
  stack?: string;
  componentStack?: string;
  /** ISO timestamp (device clock — diagnostics, not ordering). */
  at: string;
}

function truncate(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function read(): Promise<CrashRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const list = raw ? (JSON.parse(raw) as CrashRecord[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Record one caught render crash. Newest first. Never throws, never rejects —
 * callers `void` this from componentDidCatch.
 */
export async function reportCrash(input: {
  surface: string;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
}): Promise<void> {
  try {
    const record: CrashRecord = {
      surface: input.surface,
      message: truncate(input.message, MAX_MESSAGE) ?? "Unknown error",
      stack: truncate(input.stack, MAX_STACK),
      componentStack: truncate(input.componentStack, MAX_STACK),
      at: new Date().toISOString(),
    };

    // Loud in dev — a caught crash is still a bug, and silence here is how a
    // boundary turns from a safety net into a place bugs go to hide.
    if (__DEV__) {
      console.error(`[crash:${record.surface}] ${record.message}`, input.stack);
    }

    const list = await read();
    list.unshift(record);
    if (list.length > MAX_CRASHES) list.length = MAX_CRASHES;
    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(list));

    // Ship a copy, consent permitting. LAST and un-awaited on purpose: the local
    // record is the guarantee and must already be on disk before we touch the
    // network. If this line were first, a hung request would cost us the one
    // artefact we are sure to be able to keep.
    void uploadCrash({
      surface: record.surface,
      message: record.message,
      stack: record.stack,
      componentStack: record.componentStack,
      at: record.at,
    });
  } catch {
    // A crash logger that throws is worse than no crash logger.
  }
}

/** Read the black box — for a support dump or a debug screen. */
export async function getCrashLog(): Promise<CrashRecord[]> {
  return read();
}

/** How many crashes we've caught on this surface. Drives "is this thing stuck?". */
export async function countCrashes(surface?: string): Promise<number> {
  const list = await read();
  return surface ? list.filter((c) => c.surface === surface).length : list.length;
}

export async function clearCrashLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    /* fail-soft */
  }
}
