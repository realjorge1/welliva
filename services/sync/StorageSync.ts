/**
 * STORAGE SYNC — uploads/downloads for the three private buckets.
 *
 * Buckets (see supabase/migrations/20260719120000_storage_buckets.sql):
 *   avatars         profile pictures
 *   progress-photos body / progress photos
 *   gozlin-audio    voice notes to the coach
 *
 * All three are PRIVATE, so nothing here returns a plain public URL — reads go
 * through short-lived signed URLs. `users.avatar_url` therefore stores the
 * storage PATH ("<uid>/avatar.jpg"), never a signed URL: signed URLs expire, so
 * persisting one would rot in the database.
 *
 * PATH RULE: every object lives at "<uid>/<name>". Storage RLS enforces this
 * (first path segment must equal auth.uid()), so callers never build paths
 * themselves — `objectPath()` does it.
 *
 * Design rules, same as ProfileSync:
 *  - FAIL-SOFT. Nothing throws into the UI; failures log and return null/false.
 *  - No React here — pure async functions.
 *
 * BYTES IN, NOT FILE URIs. These take an ArrayBuffer rather than a local
 * "file://" URI on purpose: React Native's fetch() does not reliably give you
 * bytes for a file URI, and the usual fix (expo-file-system + base64) is a
 * native dependency this app does not have yet. Keeping the transport layer
 * dep-free means it works from any source — a picker, a recorder, or a test.
 * See readFileAsArrayBuffer() below for the wiring note.
 */
import { supabase } from "../../lib/supabase";
import { withSyncTelemetry } from "./SyncTelemetry";

export type Bucket = "avatars" | "progress-photos" | "gozlin-audio";

/** How long a signed read URL stays valid. Short — they're cheap to remint. */
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Re-sign this long before expiry so a URL never dies mid-render. */
const SIGN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

/** Build the owner-scoped object path the RLS policies require. */
export function objectPath(userId: string, fileName: string): string {
  // Strip any leading slashes/segments a caller may have passed by accident —
  // a stray "…/" would push the uid out of position 1 and RLS would reject it.
  const safe = fileName.replace(/^\/+/, "").replace(/\.\./g, "");
  return `${userId}/${safe}`;
}

/**
 * Upload bytes to a bucket. Returns the stored path, or null on failure.
 * `upsert` defaults to true so re-uploading an avatar replaces it in place
 * instead of littering the bucket with orphans.
 */
export async function uploadObject(params: {
  bucket: Bucket;
  userId: string;
  fileName: string;
  data: ArrayBuffer;
  contentType: string;
  upsert?: boolean;
}): Promise<string | null> {
  const { bucket, userId, fileName, data, contentType, upsert = true } = params;
  const path = objectPath(userId, fileName);
  try {
    await withSyncTelemetry("storage.upload", async () => {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, data, { contentType, upsert });
      if (error) throw new Error(error.message);
    });
    // A fresh upload invalidates any URL we already signed for this path.
    signedUrlCache.delete(cacheKey(bucket, path));
    return path;
  } catch (e) {
    console.warn(`StorageSync.uploadObject(${bucket}):`, e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signed reads
// ---------------------------------------------------------------------------

interface CachedUrl {
  url: string;
  /** Wall-clock ms when we should stop handing this one out. */
  staleAt: number;
}
const signedUrlCache = new Map<string, CachedUrl>();

const cacheKey = (bucket: Bucket, path: string) => `${bucket}:${path}`;

/**
 * Get a temporary read URL for a private object. Cached until shortly before it
 * expires, so a list of progress photos doesn't re-sign on every re-render.
 */
export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const hit = signedUrlCache.get(key);
  if (hit && hit.staleAt > Date.now()) return hit.url;

  try {
    const url = await withSyncTelemetry("storage.signUrl", async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, ttlSeconds);
      if (error) throw new Error(error.message);
      if (!data?.signedUrl) throw new Error("no signed URL returned");
      return data.signedUrl;
    });

    signedUrlCache.set(key, {
      url,
      staleAt: Date.now() + ttlSeconds * 1000 - SIGN_REFRESH_MARGIN_MS,
    });
    return url;
  } catch (e) {
    console.warn(`StorageSync.getSignedUrl(${bucket}):`, e);
    return null;
  }
}

/** Drop cached signed URLs. Call on sign-out — they're per-user credentials. */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

// ---------------------------------------------------------------------------
// Listing / deletion
// ---------------------------------------------------------------------------

/** List the caller's object paths in a bucket (newest first). */
export async function listObjects(
  bucket: Bucket,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(userId, {
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      console.warn(`StorageSync.listObjects(${bucket}):`, error.message);
      return [];
    }
    // `list` returns names relative to the folder; callers want full paths.
    return (data ?? [])
      .filter((o) => !!o.name)
      .map((o) => `${userId}/${o.name}`);
  } catch (e) {
    console.warn(`StorageSync.listObjects(${bucket}) (threw):`, e);
    return [];
  }
}

/** Hard-delete an object. Returns whether it went. */
export async function removeObject(
  bucket: Bucket,
  path: string,
): Promise<boolean> {
  try {
    await withSyncTelemetry("storage.remove", async () => {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw new Error(error.message);
    });
    signedUrlCache.delete(cacheKey(bucket, path));
    return true;
  } catch (e) {
    console.warn(`StorageSync.removeObject(${bucket}):`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

const AVATAR_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Upload a new avatar and point `users.avatar_url` at its path.
 *
 * The users-row write is a targeted UPDATE rather than ProfileSync.pushProfile:
 * an avatar change shouldn't drag the whole bio/goals blob up with it (and risk
 * clobbering a newer profile that another device just wrote).
 *
 * Returns the stored path, or null if either half failed.
 */
export async function uploadAvatar(params: {
  userId: string;
  data: ArrayBuffer;
  contentType: string;
}): Promise<string | null> {
  const { userId, data, contentType } = params;
  const ext = AVATAR_EXT[contentType];
  if (!ext) {
    console.warn("StorageSync.uploadAvatar: unsupported type", contentType);
    return null;
  }

  // Fixed filename → one avatar per user, replaced in place (upsert).
  const path = await uploadObject({
    bucket: "avatars",
    userId,
    fileName: `avatar.${ext}`,
    data,
    contentType,
  });
  if (!path) return null;

  try {
    const { error } = await supabase
      .from("users")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (error) {
      // The bytes are safely uploaded; only the pointer failed. Report the
      // path anyway so the caller can show it and retry the pointer later.
      console.warn("StorageSync.uploadAvatar (pointer):", error.message);
    }
  } catch (e) {
    console.warn("StorageSync.uploadAvatar (pointer threw):", e);
  }
  return path;
}

/** Resolve the stored avatar path into a URL that <Image> can render. */
export async function getAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Tolerate legacy/OAuth rows that already hold a real URL (see more.tsx,
  // which reads avatar_url straight off the provider's user metadata).
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return getSignedUrl("avatars", path);
}

/**
 * Read this user's stored avatar path from their `users` row and resolve it to a
 * renderable URL. This is how an uploaded avatar reappears after a reinstall or
 * on another device (the path lives in the cloud row, the bytes in the private
 * bucket). Fail-soft — returns null when unset or on any error.
 */
export async function fetchAvatarUrl(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data?.avatar_url) return null;
    return getAvatarUrl(data.avatar_url as string);
  } catch (e) {
    console.warn("StorageSync.fetchAvatarUrl:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Wiring note (not yet done)
// ---------------------------------------------------------------------------

/**
 * To actually pick/record a file you still need native modules this app does
 * not depend on yet:
 *
 *   expo-image-picker   choose or shoot a photo   (avatars, progress photos)
 *   expo-file-system    read that local URI       (RN fetch can't do file://)
 *
 * Both are native, so adding them means an EAS rebuild — deliberately deferred.
 * Once they're in, the bridge is:
 *
 *   const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
 *   const bytes = decode(b64);            // base64-arraybuffer
 *   await uploadAvatar({ userId, data: bytes, contentType: 'image/jpeg' });
 *
 * Nothing above needs to change when that lands.
 */
