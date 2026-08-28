/**
 * PROGRESS PHOTOS — the private body-change gallery on the fitness Progress
 * screen.
 *
 * Photos live in the private `progress-photos` bucket (RLS pins every object
 * under "<uid>/"), are read back through short-lived signed URLs, and are wiped
 * with the account. Nothing here is public and nothing is shared.
 *
 * WHAT THIS FIXES vs. the first version (which was a grid and nothing else):
 *  1. AVAILABILITY. expo-image-picker is a native module. On a build that
 *     predates it, every pick fail-softs to null — so "Add" was a button that
 *     did nothing, with no way to tell that from a cancel. We check
 *     `isImagePickerAvailable()` first and say so in plain words.
 *  2. DELETE. A body photo you regret has to be removable without deleting the
 *     whole account. Long-press a tile, or use the viewer's trash.
 *  3. SEEING THEM. Tap for a full-screen viewer with dates, a filmstrip, and a
 *     side-by-side COMPARE mode — the before/after is the entire point of
 *     taking these, and thumbnails alone can't show it. Camera capture is
 *     offered alongside the library (the permission string already shipped).
 *  4. LOUD FAILURES. Upload/delete errors surface in the card instead of
 *     leaving the UI unchanged and the user guessing.
 */
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AppText, Card, SectionHeader, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import {
  addProgressPhoto,
  isImagePickerAvailable,
  type PhotoFailure,
  type PhotoSource,
} from "@/services/sync/pickAndUpload";
import {
  getSignedUrl,
  listObjectsDetailed,
  removeObject,
} from "@/services/sync/StorageSync";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** One stored shot, resolved for display. */
interface Shot {
  path: string;
  /** Signed read URL (1h). Empty means signing failed — such rows are dropped. */
  url: string;
  /** Capture time in ms, or null when neither the name nor Storage knew. */
  takenAt: number | null;
}

/** How many tiles the card shows before collapsing the rest into a "+N". */
const GRID_LIMIT = 6;

/** Filename we write is `progress-<ms>.<ext>` — the capture time, first choice. */
const NAME_TIME = /^progress-(\d{10,})\./;

function timeOf(name: string, createdAt: string | null): number | null {
  const m = NAME_TIME.exec(name);
  if (m) {
    const ms = Number(m[1]);
    if (Number.isFinite(ms)) return ms;
  }
  if (createdAt) {
    const ms = Date.parse(createdAt);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

const shortDate = (ms: number | null) =>
  ms === null
    ? "—"
    : new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const longDate = (ms: number | null) =>
  ms === null
    ? "Date unknown"
    : new Date(ms).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

/** "13 days apart" / "6 weeks apart" — the number people actually want. */
function gapLabel(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  const days = Math.round(Math.abs(a - b) / 86_400_000);
  if (days === 0) return "Same day";
  if (days === 1) return "1 day apart";
  if (days < 21) return `${days} days apart`;
  const weeks = Math.round(days / 7);
  if (weeks < 10) return `${weeks} weeks apart`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `${months} months apart` : `${Math.round(days / 365.25)} years apart`;
}

/** The sentence for each way a pick can come back empty. */
const FAILURE_COPY: Record<PhotoFailure, string | null> = {
  // Cancelling is not an error — say nothing.
  cancelled: null,
  unavailable:
    "Photos need the latest app build — the picker isn't in this one yet. Update and try again.",
  permission:
    "Welliva needs photo access to add one. You can turn it on in your device settings.",
  failed: "That photo didn't upload. Check your connection and try again.",
};

export interface ProgressPhotosCardProps {
  /** Signed-in user id. Undefined (signed out) renders the empty state. */
  userId?: string;
}

export function ProgressPhotosCard({ userId }: ProgressPhotosCardProps) {
  const { colors } = useColors();
  const [photos, setPhotos] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<null | "upload" | "delete">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceSheet, setSourceSheet] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);

  // Checked once per mount: a native module can't appear mid-session.
  const pickerReady = useMemo(() => isImagePickerAvailable(), []);

  const load = useCallback(async () => {
    if (!userId) {
      setPhotos([]);
      return;
    }
    const rows = await listObjectsDetailed("progress-photos", userId);
    const resolved = await Promise.all(
      rows.map(async (r) => ({
        path: r.path,
        url: (await getSignedUrl("progress-photos", r.path)) ?? "",
        takenAt: timeOf(r.name, r.createdAt),
      })),
    );
    // Newest first. Storage already sorts by created_at, but the name carries
    // the truer capture time and undated rows must not float to the top.
    setPhotos(
      resolved
        .filter((p) => p.url)
        .sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0)),
    );
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startAdd = useCallback(() => {
    setNotice(null);
    if (!pickerReady) {
      setNotice(FAILURE_COPY.unavailable);
      return;
    }
    setSourceSheet(true);
  }, [pickerReady]);

  const add = useCallback(
    async (source: PhotoSource) => {
      setSourceSheet(false);
      if (!userId || busy) return;
      setBusy("upload");
      try {
        const res = await addProgressPhoto(userId, source);
        if (res.ok) await load();
        else setNotice(FAILURE_COPY[res.reason]);
      } finally {
        setBusy(null);
      }
    },
    [userId, busy, load],
  );

  const remove = useCallback(
    (shot: Shot) => {
      Alert.alert(
        "Delete this photo?",
        `Taken ${longDate(shot.takenAt)}. This removes it from your account for good.`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setNotice(null);
              setBusy("delete");
              try {
                const gone = await removeObject("progress-photos", shot.path);
                if (gone) {
                  const next = photos.filter((p) => p.path !== shot.path);
                  setPhotos(next);
                  // Keep the viewer pointing at something real — and close it
                  // if that was the last photo standing.
                  setViewerAt((at) =>
                    at === null || next.length === 0 ? null : Math.min(at, next.length - 1),
                  );
                } else {
                  setNotice("That photo couldn't be deleted. Check your connection and retry.");
                }
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
    },
    [photos],
  );

  const shown = photos.slice(0, GRID_LIMIT);
  const overflow = photos.length - shown.length;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Progress photos"
        subtitle="The change the numbers can't show"
        actionLabel={busy === "upload" ? "Adding…" : "Add"}
        onAction={busy ? undefined : startAdd}
        weight="700"
      />
      <Card>
        {photos.length > 0 ? (
          <View style={styles.grid}>
            {shown.map((p, i) => (
              <Pressable
                key={p.path}
                onPress={() => {
                  setCompare(false);
                  setViewerAt(i);
                }}
                onLongPress={() => remove(p)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Progress photo from ${longDate(p.takenAt)}`}
                accessibilityHint="Opens full screen. Long press to delete."
                style={styles.tile}
              >
                <Image
                  source={{ uri: p.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.tileFoot}>
                  <AppText variant="caption" style={styles.tileDate} numberOfLines={1}>
                    {shortDate(p.takenAt)}
                  </AppText>
                </View>
                {i === GRID_LIMIT - 1 && overflow > 0 && (
                  <View style={[styles.more, { backgroundColor: alpha("#000000", 0.55) }]}>
                    <AppText variant="title" style={styles.moreText}>
                      +{overflow}
                    </AppText>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          // Empty state as three waiting slots rather than one apologetic line —
          // it shows what the section becomes, and the first slot is the button.
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <Pressable
                key={i}
                onPress={i === 0 ? startAdd : undefined}
                disabled={!!busy || i !== 0}
                accessibilityRole={i === 0 ? "button" : undefined}
                accessibilityLabel={i === 0 ? "Add progress photo" : undefined}
                style={[styles.tile, styles.slot, { borderColor: colors.border }]}
              >
                {i === 0 && (
                  <Ionicons name="camera-outline" size={22} color={colors.textTertiary} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {photos.length > 1 && (
          <Pressable
            onPress={() => {
              setCompare(true);
              setViewerAt(0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Compare progress photos"
            style={[styles.compareBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="git-compare-outline" size={16} color={colors.primary} />
            <AppText variant="footnote" color="brand" weight="600">
              Compare first and latest
            </AppText>
          </Pressable>
        )}

        <AppText variant="footnote" color="tertiary" style={styles.hint}>
          {photos.length > 0
            ? `${photos.length} photo${photos.length === 1 ? "" : "s"} · private to your account · long-press to delete`
            : "Add one now and again — seeing the change is the best motivation."}
        </AppText>

        {notice && (
          <View
            style={[
              styles.notice,
              { backgroundColor: alpha(colors.warning, 0.12), borderColor: alpha(colors.warning, 0.4) },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              {notice}
            </AppText>
            <Pressable
              onPress={() => setNotice(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
            >
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        )}

        <LoadingOverlay
          visible={busy !== null}
          message={busy === "delete" ? "Deleting…" : "Uploading photo…"}
        />
      </Card>

      <SourceSheet
        visible={sourceSheet}
        onClose={() => setSourceSheet(false)}
        onPick={add}
      />

      <PhotoViewer
        photos={photos}
        index={viewerAt}
        compare={compare}
        onCompare={setCompare}
        onIndex={setViewerAt}
        onDelete={remove}
        onClose={() => setViewerAt(null)}
      />
    </View>
  );
}

/* ───────────────────────── source picker ───────────────────────── */

function SourceSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (source: PhotoSource) => void;
}) {
  const { colors } = useColors();
  const options: { key: PhotoSource; icon: keyof typeof Ionicons.glyphMap; label: string; sub: string }[] = [
    { key: "camera", icon: "camera-outline", label: "Take a photo", sub: "Same spot, same light, every time" },
    { key: "library", icon: "images-outline", label: "Choose from library", sub: "Pick one you've already taken" },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={<AppText variant="title">Add a progress photo</AppText>}
    >
      <View style={styles.sheetList}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onPick(o.key)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            style={styles.sheetRow}
          >
            <View style={[styles.sheetIcon, { backgroundColor: alpha(colors.primary, 0.14) }]}>
              <Ionicons name={o.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="callout" weight="600">
                {o.label}
              </AppText>
              <AppText variant="footnote" color="tertiary">
                {o.sub}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

/* ───────────────────────────── viewer ───────────────────────────── */

/**
 * Full-screen viewer. Two modes over the same filmstrip:
 *   single  — one photo, its date, delete
 *   compare — two panes; the filmstrip sets whichever pane is active, so any
 *             two shots can be put beside each other (default: first vs latest)
 *
 * Its own dark chrome, deliberately: a photo reads truest against black, and
 * this is the one place in the app that leaves the themed canvas behind.
 */
function PhotoViewer({
  photos,
  index,
  compare,
  onCompare,
  onIndex,
  onDelete,
  onClose,
}: {
  photos: Shot[];
  index: number | null;
  compare: boolean;
  onCompare: (v: boolean) => void;
  onIndex: (i: number | null) => void;
  onDelete: (shot: Shot) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // "Before" defaults to the oldest shot — the comparison people came for.
  const [beforeAt, setBeforeAt] = useState(0);
  const [activeSide, setActiveSide] = useState<"before" | "after">("after");

  useEffect(() => {
    if (compare) {
      setBeforeAt(Math.max(0, photos.length - 1));
      setActiveSide("after");
    }
  }, [compare, photos.length]);

  if (index === null || photos.length === 0) return null;

  const at = Math.min(index, photos.length - 1);
  const current = photos[at];
  const before = photos[Math.min(beforeAt, photos.length - 1)];
  const gap = compare ? gapLabel(before?.takenAt ?? null, current?.takenAt ?? null) : null;

  const pickFromStrip = (i: number) => {
    if (compare && activeSide === "before") setBeforeAt(i);
    else onIndex(i);
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <View style={[styles.viewerBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.viewerBtn}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.viewerTitle}>
            <AppText variant="callout" style={styles.viewerText} numberOfLines={1}>
              {compare ? (gap ?? "Compare") : longDate(current.takenAt)}
            </AppText>
            {!compare && (
              <AppText variant="caption" style={styles.viewerSub}>
                {at + 1} of {photos.length}
              </AppText>
            )}
          </View>

          {photos.length > 1 && (
            <Pressable
              onPress={() => onCompare(!compare)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ selected: compare }}
              accessibilityLabel={compare ? "Exit compare" : "Compare two photos"}
              style={styles.viewerBtn}
            >
              <Ionicons
                name="git-compare-outline"
                size={22}
                color={compare ? "#FFD37A" : "#FFFFFF"}
              />
            </Pressable>
          )}

          <Pressable
            onPress={() => onDelete(compare && activeSide === "before" ? before : current)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Delete this photo"
            style={styles.viewerBtn}
          >
            <Ionicons name="trash-outline" size={22} color="#FF8A80" />
          </Pressable>
        </View>

        {compare ? (
          <View style={styles.compareStage}>
            {(
              [
                { key: "before" as const, shot: before, tag: "Before" },
                { key: "after" as const, shot: current, tag: "After" },
              ]
            ).map(({ key, shot, tag }) => (
              <Pressable
                key={key}
                onPress={() => setActiveSide(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeSide === key }}
                accessibilityLabel={`${tag}: ${longDate(shot?.takenAt ?? null)}. Tap to change with the strip below.`}
                style={[
                  styles.comparePane,
                  activeSide === key && styles.comparePaneActive,
                ]}
              >
                {shot?.url ? (
                  <Image
                    source={{ uri: shot.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={120}
                  />
                ) : null}
                <View style={styles.compareTag}>
                  <AppText variant="caption" style={styles.viewerText}>
                    {tag} · {shortDate(shot?.takenAt ?? null)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Image
            source={{ uri: current.url }}
            style={styles.viewerImage}
            contentFit="contain"
            transition={150}
          />
        )}

        <View style={[styles.strip, { paddingBottom: insets.bottom + Spacing.md }]}>
          {compare && (
            <AppText variant="caption" style={styles.stripHint}>
              Tap a pane, then choose its photo below
            </AppText>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}
          >
            {photos.map((p, i) => {
              const selected = compare
                ? activeSide === "before"
                  ? i === beforeAt
                  : i === at
                : i === at;
              return (
                <Pressable
                  key={p.path}
                  onPress={() => pickFromStrip(i)}
                  accessibilityRole="imagebutton"
                  accessibilityState={{ selected }}
                  accessibilityLabel={longDate(p.takenAt)}
                  style={[styles.stripTile, selected && styles.stripTileOn]}
                >
                  <Image
                    source={{ uri: p.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={100}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** A card-less section: content on the page, separated by air alone. */
  section: { marginBottom: Spacing.xxxl },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tile: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  slot: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tileFoot: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  tileDate: { color: "#FFFFFF" },
  more: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  moreText: { color: "#FFFFFF", fontWeight: "700" },

  compareBtn: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  hint: { marginTop: Spacing.md },
  notice: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  sheetList: { gap: Spacing.xs, paddingBottom: Spacing.md },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  viewer: { flex: 1, backgroundColor: "#08090B" },
  viewerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  viewerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  viewerTitle: { flex: 1, alignItems: "center" },
  viewerText: { color: "#FFFFFF" },
  viewerSub: { color: "rgba(255,255,255,0.6)" },
  viewerImage: { flex: 1, width: "100%" },

  compareStage: { flex: 1, flexDirection: "row", gap: 2, paddingHorizontal: 2 },
  comparePane: {
    flex: 1,
    justifyContent: "flex-end",
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  comparePaneActive: { borderColor: "#FFD37A" },
  compareTag: {
    alignSelf: "center",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  strip: { paddingTop: Spacing.md, gap: Spacing.sm },
  stripHint: { color: "rgba(255,255,255,0.6)", textAlign: "center" },
  stripRow: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  stripTile: {
    width: 48,
    height: 64,
    borderRadius: Radius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  stripTileOn: { borderColor: "#FFD37A" },
});
