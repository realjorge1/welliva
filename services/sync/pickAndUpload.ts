/**
 * pickAndUpload — the picker↔StorageSync bridge (M5).
 *
 * StorageSync deliberately takes bytes (ArrayBuffer), not a local "file://" URI,
 * because React Native's fetch() can't reliably read a file URI. This module
 * produces those bytes: it opens the OS image picker with `base64: true` and
 * decodes the returned base64 in pure JS — no expo-file-system needed (in SDK 54
 * its `readAsStringAsync` moved to a legacy import, and the picker already hands
 * us the base64), so expo-image-picker is the only added native dependency.
 *
 * FAIL-SOFT, like the rest of sync: permission denied, cancel, or a missing
 * payload all resolve to null; the UI treats null as "nothing changed".
 */
// TYPE-ONLY import: erased at compile time, so it never triggers the native
// module lookup at load. The actual module is loaded lazily + guarded below.
import type * as ImagePicker from "expo-image-picker";

import { uploadAvatar, uploadObject } from "./StorageSync";

/**
 * Load expo-image-picker on demand, tolerating its absence.
 *
 * expo-image-picker is a NATIVE module. A dev client / Expo Go that wasn't
 * rebuilt after it was added won't have `ExponentImagePicker`, and eagerly
 * importing it at module top would throw and take the whole screen (Profile →
 * the tab layout) down with it. Requiring it lazily inside a try/catch keeps a
 * missing native module from ever reaching app boot: the picker simply returns
 * null until a native build includes it — exactly the fail-soft contract the
 * rest of this file already promises.
 */
function loadImagePicker(): typeof import("expo-image-picker") | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-image-picker");
  } catch {
    return null;
  }
}

/**
 * Whether the OS image picker can actually open on this build.
 *
 * The pick functions below are fail-soft by design — cancel, permission denied
 * and "the native module isn't in this build" all return null. That's right for
 * the storage layer and wrong for a button: a user tapping "change photo" on a
 * dev client that predates expo-image-picker gets a tap that does nothing, with
 * no way to tell that from cancelling. Screens call this first so they can say
 * which it was.
 */
export function isImagePickerAvailable(): boolean {
  return loadImagePicker() !== null;
}

// ── base64 → ArrayBuffer (pure JS; no atob dependency) ──────────────────────
const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const len = base64.length;
  let bufferLength = (len * 3) / 4;
  if (base64[len - 1] === "=") {
    bufferLength--;
    if (base64[len - 2] === "=") bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = B64_LOOKUP[base64.charCodeAt(i)];
    const e2 = B64_LOOKUP[base64.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[base64.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[base64.charCodeAt(i + 3)];
    if (p < bufferLength) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes.buffer;
}

/** Supported image content types → file extension. Anything else → jpeg. */
const CONTENT_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function contentTypeOf(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType;
  return mime && CONTENT_EXT[mime] ? mime : "image/jpeg";
}

/** Where a photo comes from. */
export type PhotoSource = "library" | "camera";

/**
 * Why a pick produced no photo. `null` results can't say which, and a button
 * that silently does nothing is indistinguishable from a broken one — screens
 * need the reason to write the right sentence.
 */
export type PhotoFailure =
  | "unavailable" // native module missing (dev client / Expo Go pre-rebuild)
  | "permission" // user declined library or camera access
  | "cancelled" // user backed out of the picker
  | "failed"; // picker returned nothing usable, or the upload failed

export type PhotoResult<T> = { ok: true; value: T } | { ok: false; reason: PhotoFailure };

/**
 * Ask for access + open the library picker or the camera.
 *
 * Returns a reason on every failure path so callers can distinguish "you
 * cancelled" from "this build can't open the picker at all".
 */
async function pickImageResult(
  source: PhotoSource,
  options: ImagePicker.ImagePickerOptions,
): Promise<PhotoResult<ImagePicker.ImagePickerAsset>> {
  const ImagePickerModule = loadImagePicker();
  if (!ImagePickerModule) {
    console.warn(
      "expo-image-picker native module unavailable (needs a native/EAS build). Photo pick skipped.",
    );
    return { ok: false, reason: "unavailable" };
  }
  const perm =
    source === "camera"
      ? await ImagePickerModule.requestCameraPermissionsAsync()
      : await ImagePickerModule.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "permission" };

  const args: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.8,
    base64: true,
    ...options,
  };
  const res =
    source === "camera"
      ? await ImagePickerModule.launchCameraAsync(args)
      : await ImagePickerModule.launchImageLibraryAsync(args);

  if (res.canceled) return { ok: false, reason: "cancelled" };
  const asset = res.assets[0];
  if (!asset?.base64) return { ok: false, reason: "failed" };
  return { ok: true, value: asset };
}

/** Ask for library access + open the picker; returns the chosen asset or null. */
async function pickImage(
  options: ImagePicker.ImagePickerOptions,
): Promise<ImagePicker.ImagePickerAsset | null> {
  const res = await pickImageResult("library", options);
  return res.ok ? res.value : null;
}

/**
 * Pick a square photo and set it as the user's avatar. Returns the stored path
 * (also written to `users.avatar_url` by uploadAvatar, so it round-trips across
 * devices/reinstalls), or null if cancelled / denied / upload failed.
 */
export async function pickAvatar(userId: string): Promise<string | null> {
  const asset = await pickImage({ allowsEditing: true, aspect: [1, 1] });
  if (!asset?.base64) return null;
  return uploadAvatar({
    userId,
    data: base64ToArrayBuffer(asset.base64),
    contentType: contentTypeOf(asset),
  });
}

/**
 * Shoot or pick a progress/body photo and upload it to the private
 * progress-photos bucket under a timestamped name (upsert off — every photo is
 * kept, and the timestamp in the name is what dates the gallery when Storage
 * doesn't report a creation time).
 *
 * Returns the stored path on success, or the reason nothing was added.
 */
export async function addProgressPhoto(
  userId: string,
  source: PhotoSource = "library",
): Promise<PhotoResult<string>> {
  const picked = await pickImageResult(source, {});
  if (!picked.ok) return picked;

  const asset = picked.value;
  const contentType = contentTypeOf(asset);
  const ext = CONTENT_EXT[contentType] ?? "jpg";
  const path = await uploadObject({
    bucket: "progress-photos",
    userId,
    fileName: `progress-${Date.now()}.${ext}`,
    data: base64ToArrayBuffer(asset.base64!),
    contentType,
    upsert: false,
  });
  return path ? { ok: true, value: path } : { ok: false, reason: "failed" };
}

/** Back-compat shim: the stored path, or null for any failure. */
export async function pickProgressPhoto(userId: string): Promise<string | null> {
  const res = await addProgressPhoto(userId, "library");
  return res.ok ? res.value : null;
}
