/**
 * DOCUMENT SYNC — the transport for the generic per-user document mirror.
 *
 * Every synced AsyncStorage key becomes one row in `sync_documents`
 * (user_id, doc_key, doc). The device is the source of truth; this is the
 * durable cloud copy that lets a user continue on any device. Same fail-soft,
 * telemetry-wrapped discipline as ProfileSync.
 *
 * VALUES ARE OPAQUE STRINGS. We store the raw AsyncStorage string verbatim in
 * the JSONB `doc` column (as a JSON string scalar) rather than parsing it into a
 * typed shape. That is deliberate: it is lossless for all ~50 heterogeneous keys
 * with ONE code path and zero per-key adapters, and it round-trips byte-for-byte.
 * These blobs are explicitly not for server-side querying — the typed `users`
 * columns (ProfileSync) cover analytics.
 */
import { supabase } from "../../lib/supabase";
import { withSyncTelemetry } from "./SyncTelemetry";

/** One remote document as the engine consumes it. */
export interface RemoteDoc {
  key: string;
  /** Raw AsyncStorage string, or null when the row is a tombstone. */
  value: string | null;
  /** Server-stamped ISO timestamp — the LWW ordering key. */
  updatedAt: string;
  /** True when this row is a delete tombstone. */
  deleted: boolean;
}

/** Ephemeral per-launch id, for debugging "which device last wrote" only. */
const DEVICE_ID = `dev_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Upsert one key's current value. `value === null` writes a tombstone (soft
 * delete) so the deletion propagates to other devices. Returns the server
 * `updated_at`, or null on any failure (fail-soft — the caller keeps the key
 * queued and retries later).
 */
export async function pushDoc(
  userId: string,
  key: string,
  value: string | null,
): Promise<string | null> {
  try {
    return await withSyncTelemetry("document.push", async () => {
      const { data, error } = await supabase
        .from("sync_documents")
        .upsert(
          {
            user_id: userId,
            doc_key: key,
            doc: value,
            deleted_at: value === null ? new Date().toISOString() : null,
            device_id: DEVICE_ID,
          },
          { onConflict: "user_id,doc_key" },
        )
        .select("updated_at")
        .single();

      if (error) throw new Error(error.message);
      return (data as { updated_at: string } | null)?.updated_at ?? null;
    });
  } catch (e) {
    console.warn(`DocumentSync.pushDoc(${key}):`, e);
    return null;
  }
}

/**
 * Delta pull: every doc for this user changed since `sinceIso` (null = full
 * pull), oldest change first so watermarks advance monotonically. Returns [] on
 * failure (fail-soft — a missed pull just means we try again next login/foreground).
 */
export async function pullDocsSince(
  userId: string,
  sinceIso: string | null,
): Promise<RemoteDoc[]> {
  try {
    return await withSyncTelemetry("document.pull", async () => {
      let q = supabase
        .from("sync_documents")
        .select("doc_key, doc, updated_at, deleted_at")
        .eq("user_id", userId);
      if (sinceIso) q = q.gt("updated_at", sinceIso);
      const { data, error } = await q.order("updated_at", { ascending: true });

      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        doc_key: string;
        doc: unknown;
        updated_at: string;
        deleted_at: string | null;
      }[];
      return rows.map((r) => {
        const deleted = r.deleted_at != null;
        let value: string | null = null;
        if (!deleted && r.doc != null) {
          // We store raw strings, so `doc` comes back as a string. Defensively
          // re-encode anything else (a hand-edited row) so the device still gets
          // valid content.
          value = typeof r.doc === "string" ? r.doc : JSON.stringify(r.doc);
        }
        return { key: r.doc_key, value, updatedAt: r.updated_at, deleted };
      });
    });
  } catch (e) {
    console.warn("DocumentSync.pullDocsSince:", e);
    return [];
  }
}
