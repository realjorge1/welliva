/**
 * STORE ERRORS — turn a RevenueCat failure into a sentence someone can act on.
 *
 * Every store call used to collapse its failure into one of two things: an
 * empty list (offerings) or the SDK's raw `message` (purchases). The empty list
 * rendered as "Check your connection and try again" whatever actually happened,
 * so a console problem — a base plan left inactive, a tester account missing
 * from the track — was indistinguishable from bad WiFi, and retrying forever
 * was the only thing the screen offered.
 *
 * So the failure is classified here, once, by RevenueCat's own error code:
 *
 *  · `message` is what a CUSTOMER reads. It never names RevenueCat, a console,
 *    or an error code, and it always says whether money moved.
 *  · `detail` is what a DEVELOPER reads — the readable code and the store's
 *    underlying message, which is where "None of the products registered in the
 *    RevenueCat dashboard could be fetched from the Play Store" actually lives.
 *    The storefront prints it in `__DEV__` builds only.
 *
 * Pure on purpose (no react-native import), so it runs under vitest.
 */

/** What kind of failure — decides the sentence, and whether retrying can help. */
export type StoreProblemKind =
  /** No connection to the store or to RevenueCat. Retrying can help. */
  | "network"
  /** Console-side: products, credentials or the app's track. Retrying won't help. */
  | "setup"
  /** Google Play itself failed. Retrying later can help. */
  | "store"
  /** The account or device may not buy (parental controls, region, no Play). */
  | "not-allowed"
  /** The account already owns this — the answer is Restore, not Buy. */
  | "owned"
  /** A payment the store accepted but hasn't confirmed (cash, slow cards). */
  | "pending"
  | "unknown";

export interface StoreProblem {
  kind: StoreProblemKind;
  /** Customer-facing. Safe to render in a release build. */
  message: string;
  /** Developer-facing: readable code + the store's underlying message. */
  detail: string;
}

/** Which call failed — the same code reads differently mid-purchase. */
export type StoreStage = "offerings" | "purchase" | "restore";

/**
 * RevenueCat's `PURCHASES_ERROR_CODE` values this module distinguishes.
 * Mirrored as literals rather than imported, so this file stays loadable
 * without the native SDK (see the lazy-require note in Billing.ts).
 */
const CODE = {
  STORE_PROBLEM: "2",
  PURCHASE_NOT_ALLOWED: "3",
  PRODUCT_NOT_AVAILABLE: "5",
  PRODUCT_ALREADY_PURCHASED: "6",
  NETWORK: "10",
  INVALID_CREDENTIALS: "11",
  PAYMENT_PENDING: "20",
  CONFIGURATION: "23",
  OFFLINE_CONNECTION: "35",
} as const;

const KIND_BY_CODE: Record<string, StoreProblemKind> = {
  [CODE.STORE_PROBLEM]: "store",
  [CODE.PURCHASE_NOT_ALLOWED]: "not-allowed",
  [CODE.PRODUCT_NOT_AVAILABLE]: "setup",
  [CODE.PRODUCT_ALREADY_PURCHASED]: "owned",
  [CODE.NETWORK]: "network",
  [CODE.INVALID_CREDENTIALS]: "setup",
  [CODE.PAYMENT_PENDING]: "pending",
  [CODE.CONFIGURATION]: "setup",
  [CODE.OFFLINE_CONNECTION]: "network",
};

/**
 * The customer's sentence for each kind, per stage. "Nothing has been charged"
 * appears wherever it is TRUE, because it is the first thing anyone wonders
 * when a payment screen shows an error — and it is never said after a pending
 * payment, where it would be false.
 */
function messageFor(kind: StoreProblemKind, stage: StoreStage): string {
  switch (kind) {
    case "network":
      return "Couldn't reach Google Play. Check your connection and try again. Nothing has been charged.";
    case "setup":
      return stage === "offerings"
        ? "Plans aren't available on this device yet. Nothing has been charged."
        : "This plan isn't available to buy on this device right now. Nothing has been charged.";
    case "store":
      return "Google Play ran into a problem. Try again in a moment. Nothing has been charged.";
    case "not-allowed":
      return "Purchases aren't allowed for the Google account on this device. Nothing has been charged.";
    case "owned":
      return "This Google account already has Pro. Tap Restore purchases to bring it onto this account.";
    case "pending":
      return "Your payment is pending. Pro unlocks by itself as soon as Google Play confirms it.";
    default:
      return stage === "restore"
        ? "Couldn't restore purchases. Try again in a moment."
        : "Something went wrong with the store. Nothing has been charged.";
  }
}

/** The fields RevenueCat's `PurchasesError` carries, all optional here. */
interface ErrorLike {
  code?: unknown;
  message?: unknown;
  readableErrorCode?: unknown;
  underlyingErrorMessage?: unknown;
  userInfo?: { readableErrorCode?: unknown } | null;
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Classify any thrown value from a store call. Never throws itself. */
export function describeStoreError(error: unknown, stage: StoreStage): StoreProblem {
  const e = (error && typeof error === "object" ? error : {}) as ErrorLike;
  const code = e.code === undefined || e.code === null ? "" : String(e.code);
  const kind = KIND_BY_CODE[code] ?? "unknown";

  const readable = text(e.userInfo?.readableErrorCode) || text(e.readableErrorCode);
  const parts = [
    readable || (code ? `code ${code}` : ""),
    text(e.message) || (typeof error === "string" ? error : ""),
    text(e.underlyingErrorMessage),
  ].filter(Boolean);

  return {
    kind,
    message: messageFor(kind, stage),
    // Duplicate halves happen (the SDK often repeats itself) — say each once.
    detail: [...new Set(parts)].join(" — ") || "No error detail was given.",
  };
}

/**
 * The offering loaded without an error but holds nothing this storefront can
 * sell. Almost always the console: the packages exist in RevenueCat, but Play
 * returned none of their products to this device.
 */
export function emptyOfferingProblem(detail: string): StoreProblem {
  return { kind: "setup", message: messageFor("setup", "offerings"), detail };
}
