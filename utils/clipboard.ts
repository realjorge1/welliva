/**
 * clipboard — copy text, without importing a deprecation warning.
 *
 * React Native still ships a Clipboard module, but reading it off the
 * `react-native` barrel trips a console warning on every import ("Clipboard has
 * been extracted from react-native core…"), which in a dev session is noise on
 * a path that is otherwise perfectly fine. Requiring the module directly gets
 * the same implementation without the getter that warns.
 *
 * It is written as a lookup rather than a static import for one reason: when
 * `expo-clipboard` is eventually added (it needs a native rebuild, so it isn't
 * here yet), this file is the only thing that changes — every call site keeps
 * calling `copyText`.
 *
 * COPYING NEVER THROWS. A failed copy is a silent no-op that reports false; the
 * caller decides whether that is worth telling anyone about. Nothing in this app
 * is important enough to interrupt someone with "could not copy".
 */

type ClipboardLike = { setString: (value: string) => void };

let resolved: ClipboardLike | null | undefined;

function clipboard(): ClipboardLike | null {
  if (resolved !== undefined) return resolved;
  resolved = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native/Libraries/Components/Clipboard/Clipboard");
    const impl = (mod?.default ?? mod) as ClipboardLike | undefined;
    if (impl && typeof impl.setString === "function") resolved = impl;
  } catch {
    /* no clipboard on this platform — copyText degrades to false */
  }
  return resolved;
}

/** Put `text` on the system clipboard. Returns whether it actually happened. */
export function copyText(text: string): boolean {
  const impl = clipboard();
  if (!impl) return false;
  try {
    impl.setString(text);
    return true;
  } catch {
    return false;
  }
}
