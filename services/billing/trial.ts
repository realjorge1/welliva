/**
 * THE INSIGHT TRIAL — 48 hours of Pro, granted at the moment it can prove itself.
 *
 * WHY NOT A STORE TRIAL AT SIGN-UP
 *
 * A trial that starts when someone installs the app is spent before the app
 * knows anything about them. Day one there is no history to read, no pattern to
 * find and no plan worth generating — so the tier gets evaluated on an empty
 * database and judged, correctly, as not worth paying for. By the time Welliva
 * actually has something to say, the trial has quietly expired and the user
 * never saw the product at its best.
 *
 * So this one is triggered by READINESS, not by signup: it starts the first time
 * the habit engine has a real, evidence-backed finding about this person. That
 * is the earliest moment Pro can demonstrate rather than describe itself, and it
 * is the moment the ask makes sense.
 *
 * THE SERVER IS THE AUTHORITY, WHEN THERE IS ONE
 *
 * The window is CLAIMED from the backend, not granted on the phone. The client
 * asks; the server decides, records the claim against the account, and returns
 * the window it will itself enforce. That ordering is what keeps three things
 * true at once:
 *
 *   • the app and the backend can never disagree about whether someone is on
 *     Pro — the one mismatch that would show up as the coach refusing a turn on
 *     a screen that says the coach is unlimited;
 *   • the trial is once per ACCOUNT rather than once per install, so it cannot
 *     be farmed by reinstalling;
 *   • the give-away is bounded somewhere a modified client cannot reach.
 *
 * The claim goes through an injected seam (`setTrialClaimer`) rather than a
 * direct import, for the same reason the sync push gate does: this module is
 * unit-tested without a React Native runtime, and `WellivaApi` pulls in
 * `expo/fetch` and the Supabase client.
 *
 * UNTIL THAT ENDPOINT EXISTS, IT FALLS BACK TO A LOCAL GRANT
 *
 * No claimer registered, no network, signed out, or a 404 because
 * `/v1/billing/trial/claim` is not deployed yet — all of them fall through to
 * granting the window on the device, which is exactly what this module did
 * before. So the feature ships now and upgrades itself the day the endpoint
 * appears, with no client release in between.
 *
 * WHAT THIS IS, PRECISELY
 *
 * A PROMOTIONAL GRANT, not an App Store / Play trial. Nothing is charged, no
 * payment method is taken, no store product is involved, and nothing renews —
 * it simply expires. Three consequences worth being clear-eyed about:
 *
 *  1. It cannot convert automatically. When it lapses the user is back on their
 *     real tier and must choose to buy, which is a weaker funnel than a
 *     card-on-file trial and a much better deal for the user. That trade is
 *     deliberate: a trial that silently starts charging is the single most
 *     complained-about pattern in subscription apps.
 *  2. On the LOCAL fallback path only, it is device-local and clearable — someone
 *     determined to farm 48-hour windows by reinstalling can, exactly as with
 *     the usage meters. On the server path they cannot, because the claim is
 *     recorded against the account. This is the single strongest reason to ship
 *     `/v1/billing/trial/claim` early rather than with the rest of Part 6.
 *  3. ⚠️ IT COSTS REAL INFERENCE. Pro is metered at 100 coach turns a day, so a
 *     48-hour window is a worst case of ~200 Haiku turns given away per user who
 *     reaches their first insight. At current margins that is the most expensive
 *     line in this directory. If it bites, the lever is a trial-specific coach
 *     cap here rather than a shorter window — the window is what makes the
 *     feature legible; the turns are what cost money.
 *
 * ONCE, EVER
 *
 * A used trial is recorded permanently, so it cannot restart on the next insight
 * or the next month. `hasEverStarted` outlives the trial itself for that reason.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Tier } from "./tiers";

/** How long the window lasts. Two full days, so it spans a weekend or a work pair. */
export const TRIAL_HOURS = 48;

/** The tier the trial grants. The whole point is that it is the top one. */
export const TRIAL_TIER: Tier = "pro";

const STORAGE_KEY = "@welliva_insight_trial";

export interface InsightTrial {
  /** ISO timestamp the window opened. */
  startedAt: string;
  /** ISO timestamp it closes. */
  expiresAt: string;
}

/**
 * What the backend says about this account's trial.
 *
 * Returned whether or not this call is the one that opened the window —
 * `alreadyClaimed` distinguishes them — and the window is returned even when it
 * has already EXPIRED. That last part is the anti-farming property: a reinstall
 * asks again, is told "claimed, and it ended on Tuesday", and gets nothing.
 */
export interface RemoteTrialClaim {
  /** ISO expiry the server will itself enforce. */
  expiresAt: string;
  /** ISO time the window was first claimed — possibly in an earlier install. */
  claimedAt: string;
  /** True when this account had already claimed before this call. */
  alreadyClaimed: boolean;
}

/** Injected by the composition root. Returns null when the backend can't answer. */
export type TrialClaimer = () => Promise<RemoteTrialClaim | null>;

let claimer: TrialClaimer | null = null;

/**
 * Register the backend claim call. Pass null to detach (tests, sign-out).
 * See the header for why this is injected rather than imported.
 */
export function setTrialClaimer(fn: TrialClaimer | null): void {
  claimer = fn;
}

interface StoredTrial {
  /** Sticky: stays true after expiry, so the trial can never be re-granted. */
  hasEverStarted: boolean;
  trial: InsightTrial | null;
  /**
   * Which authority granted this window. `server` means the backend recorded it
   * against the account and will enforce the same expiry; `local` means it was
   * granted on the device because the backend could not be reached, and the
   * server may still meter this user at their real tier.
   */
  source: "server" | "local";
}

const EMPTY: StoredTrial = { hasEverStarted: false, trial: null, source: "local" };

let state: StoredTrial = EMPTY;
let hydrated = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[billing] trial listener threw:", e);
    }
  });
}

/** Subscribe to trial start/expiry. Returns an unsubscribe fn. */
export function subscribeTrial(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[billing] trial persist failed:", e);
  }
}

/**
 * Load the trial record. Call once at startup, alongside the entitlement — a
 * user mid-trial who cold-starts must be on Pro for the first frame rather than
 * flashing their real tier.
 */
export async function hydrateTrial(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredTrial>;
      state = {
        hasEverStarted: parsed.hasEverStarted === true,
        trial: parsed.trial ?? null,
        // Records written before the server path existed are local grants.
        source: parsed.source === "server" ? "server" : "local",
      };
    }
  } catch (e) {
    console.warn("[billing] trial hydrate failed:", e);
    state = EMPTY;
  }
  hydrated = true;
  emit();
}

/** The trial window, whether or not it is still open. */
export function trialRecord(): InsightTrial | null {
  return state.trial;
}

/** True once a trial has ever been granted on this device. */
export function hasUsedTrial(): boolean {
  return state.hasEverStarted;
}

/**
 * Which authority granted the current window.
 *
 * `local` is the honest warning sign: the app is granting Pro that the backend
 * has not been told about, so anything the SERVER meters (coach turns, photo
 * scans) may still refuse at the user's real tier. Worth surfacing in dev tools
 * and worth checking first when someone reports "it says Pro but the coach
 * stopped answering".
 */
export function trialSource(): "server" | "local" {
  return state.source;
}

/**
 * The live trial, or null when there is none or it has lapsed.
 *
 * Expiry is re-checked on every call rather than on a timer, so a window that
 * closes while the app sits open stops granting access the next time anything
 * asks — no background task, and no way for a stale timer to extend it.
 */
export function activeTrial(now: Date = new Date()): InsightTrial | null {
  const t = state.trial;
  if (!t) return null;
  return new Date(t.expiresAt).getTime() > now.getTime() ? t : null;
}

/**
 * The tier the trial is currently granting, or `null`.
 *
 * Read by `effectiveTier()` in gating.ts, which takes the HIGHER of this and the
 * user's real entitlement — so a trial can lift a free user to Pro but can never
 * demote a paying one, and a Plus subscriber who trials Pro keeps Plus when it
 * lapses.
 */
export function trialTier(now: Date = new Date()): Tier | null {
  return activeTrial(now) ? TRIAL_TIER : null;
}

/** Whole hours left in the window, floored. Zero when nothing is active. */
export function trialHoursLeft(now: Date = new Date()): number {
  const t = activeTrial(now);
  if (!t) return 0;
  const ms = new Date(t.expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 3_600_000));
}

/**
 * Open the window, if this user should get one. Returns true only when a trial
 * actually started, so the caller can celebrate it exactly once.
 *
 * Declines — deliberately quietly — in four cases:
 *  • before hydration, so a cold start cannot grant a second trial over one that
 *    is already recorded but not yet read from disk;
 *  • when one has ever been granted before;
 *  • when the user already subscribes, because giving a paying customer a free
 *    window of what they already bought is at best confusing and at worst reads
 *    as a refund they never get;
 *  • when billing is not enforced in this build at all — everything is already
 *    unlocked there, so "burning" the one-time trial on a dev build would mean
 *    the user never gets it in the release build.
 */
export async function maybeStartInsightTrial(opts: {
  isSubscriber: boolean;
  gatingActive: boolean;
  now?: Date;
}): Promise<boolean> {
  if (!hydrated || state.hasEverStarted || opts.isSubscriber || !opts.gatingActive) return false;

  const now = opts.now ?? new Date();

  // ── Ask the server first. It owns the answer when it can give one. ────────
  if (claimer) {
    let remote: RemoteTrialClaim | null = null;
    try {
      remote = await claimer();
    } catch {
      // Not deployed, offline, signed out — all the same to us. Fall through.
      remote = null;
    }
    if (remote?.expiresAt) {
      // Recorded verbatim, INCLUDING an already-expired window. Honouring the
      // server's "you already had yours" is the whole point of asking.
      state = {
        hasEverStarted: true,
        trial: { startedAt: remote.claimedAt, expiresAt: remote.expiresAt },
        source: "server",
      };
      emit();
      await persist();
      // Only a window this call actually opened, and that is still open, counts
      // as a start — the caller uses this to celebrate exactly once.
      return !remote.alreadyClaimed && activeTrial(now) !== null;
    }
  }

  // ── Fallback: grant it here, and mark it as ours so we know it is unbacked. ──
  const expires = new Date(now.getTime() + TRIAL_HOURS * 3_600_000);
  state = {
    hasEverStarted: true,
    trial: { startedAt: now.toISOString(), expiresAt: expires.toISOString() },
    source: "local",
  };
  emit();
  await persist();
  return true;
}

/**
 * Drop the trial on sign-out, so the next account on this device does not
 * inherit a window it did not earn.
 *
 * NOTE this clears `hasEverStarted` too. That is the right trade while the grant
 * is device-local: keeping it would deny a genuinely different person their
 * trial because someone else used this phone, which is a worse failure than
 * letting a determined user re-earn one by signing out. When the record moves
 * server-side (Part 6) it becomes per-account and this stops being a choice.
 */
export async function clearTrial(): Promise<void> {
  state = EMPTY;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
