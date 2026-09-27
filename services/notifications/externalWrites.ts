/**
 * services/notifications/externalWrites.ts
 *
 * THE LIVE-UPDATE BUS for writes that happened behind React's back.
 *
 * A lock-screen button writes straight to storage (there may be no React tree
 * at all when it's pressed). When the app IS alive — open on screen, or
 * backgrounded with its JS still running — nothing in React would otherwise know
 * that a habit it is rendering was just completed or that today's water moved.
 * Every lock-screen write announces itself here, and the providers that hold the
 * affected state re-read it from storage, so the change shows up in real time:
 * rings fill, streaks tick, the diet screen checks the meal off.
 *
 * The other half — the app was suspended or killed when the write happened — is
 * covered by an AppState → active re-read in the same providers. In-process
 * events cannot cross a process that wasn't running.
 *
 * Pure module: no react-native, no storage. Loadable under the Node test runner.
 */

/** What moved. Subscribers re-read only what they hold. */
export type ExternalWriteKind = "habit" | "meal" | "water" | "streak";

export interface ExternalWrite {
  kind: ExternalWriteKind;
  /** Local YYYY-MM-DD the write landed on. */
  date: string;
}

type Listener = (write: ExternalWrite) => void;
const listeners = new Set<Listener>();

/** Observe out-of-band writes. Returns an unsubscribe. */
export function subscribeExternalWrites(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Announce an out-of-band write. Never throws. */
export function emitExternalWrite(write: ExternalWrite): void {
  for (const fn of [...listeners]) {
    try {
      fn(write);
    } catch {
      // one bad listener must not stop the others
    }
  }
}
