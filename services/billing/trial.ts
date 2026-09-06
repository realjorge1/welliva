/**
 * THE GOZLIN INTRO WINDOW — 30 hours of the AI, free, from first launch.
 *
 * WHAT IT GRANTS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * This window opens GOZLIN and nothing else. `TRIAL_FEATURES` below is the exact
 * list: the coach conversation, the research behind an answer, generated plans,
 * insights you can open, and photo meal logging — every capability that spends
 * inference. It does NOT grant the other half of Pro (`habits`, `foods`, `sync`,
 * `history`), because those sell depth over data the user has not accumulated
 * yet. Handing someone unlimited history on their first day gives away a paid
 * feature at the one moment it cannot possibly impress them.
 *
 * That scoping is why this is no longer expressed as a TIER. It used to raise
 * `effectiveTier()` to `pro`, which lifted every lock at once; now it answers a
 * narrower question — `trialGrants(feature)` — and `featureTier()` in gating.ts
 * is what folds it back into the one check every lock already makes. The
 * consequence worth knowing: `effectiveTier()` still reports `free` during the
 * window, so anything that reads a TIER (history clamping, the storefront's own
 * cards, `hasPaidAccess`) correctly continues to treat this person as free.
 *
 * WHY IT STARTS AT FIRST LAUNCH
 *
 * The previous version started on READINESS — the first time the habit engine
 * produced an evidence-backed finding — on the theory that a trial spent against
 * an empty database gets judged on nothing. That reasoning was sound and it is
 * why the window is scoped rather than shortened: the thing being given away is
 * the CONVERSATION, and a conversation is worth having on day one. You can ask
 * Gozlin a question before you have logged anything; you cannot be impressed by
 * a 400-day chart you do not have yet.
 *
 * So the clock now starts the first time the app runs with gating on, which
 * makes the offer legible ("30 hours of Gozlin, free") in a way a trigger nobody
 * can see never was.
 *
 * ⚠️ COST: THIS NOW FIRES FOR EVERY INSTALL, NOT A FEW
 *
 * The readiness trigger meant only users who reached a real finding ever cost
 * anything. A first-launch window fires for everyone who opens the app — tyre
 * kickers, bots and duplicate installs included — and during it `featureTier()`
 * resolves the coach to PRO_TIER.coachMessagesPerDay (100/day), so the worst
 * case is ~125 Haiku turns per install. Nothing here caps it below the Pro
 * ceiling. If that bites, the lever is a window-specific coach cap in this file
 * rather than a shorter window: the 30 hours are what make the offer legible;
 * the turns are what cost money.
 *
 * THE SERVER IS THE AUTHORITY, WHEN THERE IS ONE
 *
 * The window is CLAIMED from the backend, not granted on the phone. The client
 * asks; the server decides, records the claim against the account, and returns
 * the window it will itself enforce. That ordering keeps three things true:
 *
 *   • the app and the backend can never disagree about whether Gozlin is open —
 *     the one mismatch that shows up as the coach refusing a turn on a screen
 *     that says the coach is unlocked;
 *   • the window is once per ACCOUNT rather than once per install, so it cannot
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
 * granting the window on the device. So the feature ships now and upgrades
 * itself the day the endpoint appears, with no client release in between.
 *
 * WHAT THIS IS, PRECISELY
 *
 * A PROMOTIONAL GRANT, not an App Store / Play trial. Nothing is charged, no
 * payment method is taken, no store product is involved, and nothing renews — it
 * simply expires. Two consequences worth being clear-eyed about:
 *
 *  1. It cannot convert automatically. When it lapses the user is back on free
 *     and must choose to buy, which is a weaker funnel than a card-on-file trial
 *     and a much better deal for the user. That trade is deliberate: a trial
 *     that silently starts charging is the single most complained-about pattern
 *     in subscription apps.
 *  2. On the LOCAL fallback path only, it is device-local and clearable — someone
 *     determined to farm 30-hour windows by reinstalling can, exactly as with
 *     the usage meters. On the server path they cannot, because the claim is
 *     recorded against the account. This is the single strongest reason to ship
 *     `/v1/billing/trial/claim` early rather than with the rest of Part 6.
 *
 * ONCE, EVER
 *
 * A used window is recorded permanently, so it cannot restart on the next launch
 * or the next month. `hasEverStarted` outlives the window itself for that reason.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FeatureId } from "./tiers";

/** How long the window lasts, from first launch. */
export const TRIAL_HOURS = 30;

/**
 * EXACTLY WHAT THE WINDOW OPENS — every capability that spends inference.
 *
 * This is the "Gozlin (AI)" half of the Pro card, and it is deliberately not the
 * whole tier: `habits`, `foods`, `sync` and `history` sell depth over data a
 * first-launch user does not have yet, so giving them away here would spend a
 * paid feature at the moment it is least persuasive. See the header.
 *
 * These ids are the same vocabulary the locks and the storefront use, so a
 * feature added to the Pro card is a one-line decision here: does the free
 * window open it, or not?
 */
export const TRIAL_FEATURES: readonly FeatureId[] = [
  "coach-limit", // the conversation itself
  "deep-dive", // the research behind an answer
  "ai-plans", // diet + workout plans written for this body
  "insights", // correlations and nudges you can open
  "photo-log", // portions read from a photo
] as const;

const STORAGE_KEY = "@welliva_insight_trial";

export interface TrialWindow {
  /** ISO timestamp the window opened. */
  startedAt: string;
  /** ISO timestamp it closes. */
  expiresAt: string;
}

/**
 * What the backend says about this account's window.
 *
 * Returned whether or not this call is the one that opened it — `alreadyClaimed`
 * distinguishes them — and the window is returned even when it has already
 * EXPIRED. That last part is the anti-farming property: a reinstall asks again,
 * is told "claimed, and it ended on Tuesday", and gets nothing.
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
  /** Sticky: stays true after expiry, so the window can never be re-granted. */
  hasEverStarted: boolean;
  trial: TrialWindow | null;
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

/** Subscribe to window start/expiry. Returns an unsubscribe fn. */
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
 * Load the window record. Call once at startup, alongside the entitlement — a
 * user mid-window who cold-starts must have Gozlin open on the first frame
 * rather than flashing the locked version of it.
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

/** The window, whether or not it is still open. */
export function trialRecord(): TrialWindow | null {
  return state.trial;
}

/** True once a window has ever been granted on this device. */
export function hasUsedTrial(): boolean {
  return state.hasEverStarted;
}

/**
 * Which authority granted the current window.
 *
 * `local` is the honest warning sign: the app is opening Gozlin without the
 * backend having been told, so anything the SERVER meters (coach turns, photo
 * scans) may still refuse at the user's real tier. Worth surfacing in dev tools
 * and worth checking first when someone reports "it says free but the coach
 * stopped answering".
 */
export function trialSource(): "server" | "local" {
  return state.source;
}

/**
 * The live window, or null when there is none or it has lapsed.
 *
 * Expiry is re-checked on every call rather than on a timer, so a window that
 * closes while the app sits open stops granting access the next time anything
 * asks — no background task, and no way for a stale timer to extend it.
 */
export function activeTrial(now: Date = new Date()): TrialWindow | null {
  const t = state.trial;
  if (!t) return null;
  return new Date(t.expiresAt).getTime() > now.getTime() ? t : null;
}

/**
 * Does the live window open THIS feature?
 *
 * Read by `featureTier()` in gating.ts, which takes the higher of this and the
 * user's real tier — so the window can lift a free user into Gozlin but can
 * never demote a paying one, and it can never reach a feature outside
 * {@link TRIAL_FEATURES}.
 *
 * This replaced a `trialTier()` that returned `"pro"` for everything. The whole
 * point of the change is that a window is no longer a tier: it is a set.
 */
export function trialGrants(feature: FeatureId, now: Date = new Date()): boolean {
  return activeTrial(now) !== null && TRIAL_FEATURES.includes(feature);
}

/** Whole hours left in the window, floored. Zero when nothing is active. */
export function trialHoursLeft(now: Date = new Date()): number {
  const t = activeTrial(now);
  if (!t) return 0;
  const ms = new Date(t.expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 3_600_000));
}

/**
 * Open the window, if this user should get one. Returns true only when one
 * actually started, so the caller can celebrate it exactly once.
 *
 * Called from the composition root once hydration lands, so "first launch" means
 * the first run in which all four of these are true. It declines — deliberately
 * quietly — in four cases:
 *  • before hydration, so a cold start cannot grant a second window over one
 *    that is already recorded but not yet read from disk;
 *  • when one has ever been granted before;
 *  • when the user already subscribes, because giving a paying customer a free
 *    window of what they already bought is at best confusing and at worst reads
 *    as a refund they never get;
 *  • when billing is not enforced in this build at all — everything is already
 *    unlocked there, so burning the one-time window on a dev build would mean
 *    the user never gets it in the release build.
 */
export async function maybeStartTrial(opts: {
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
 * Drop the window on sign-out, so the next account on this device does not
 * inherit one it did not earn.
 *
 * NOTE this clears `hasEverStarted` too. That is the right trade while the grant
 * is device-local: keeping it would deny a genuinely different person their
 * window because someone else used this phone, which is a worse failure than
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
