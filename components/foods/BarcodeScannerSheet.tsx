/**
 * BarcodeScannerSheet — point the camera at a package, get the label.
 *
 * ── WHY THIS SCREEN IS SHAPED LIKE THIS ─────────────────────────────────────
 * Logging a packaged meal is the core loop of a food tracker and it is the one
 * place this app was decisively behind: search a curated catalog, miss, fall
 * through to a network lookup. Two seconds versus twenty. Everything here is
 * subordinate to making the common case — scan, confirm, done — as short as it
 * can honestly be.
 *
 * "Honestly" is doing real work in that sentence. A scan resolves to a
 * MANUFACTURER'S DECLARED LABEL transcribed by a volunteer, which is a real
 * measurement with a real failure mode, so the result is shown with the same
 * provenance furniture every other number in this app carries (see
 * services/nutrition/OpenFoodFacts.ts). It is never auto-committed: the user
 * sees the product, the serving and the confidence rung, and taps to add.
 *
 * ── EVERY FAILURE LANDS SOMEWHERE USEFUL ────────────────────────────────────
 * This screen is used standing in a supermarket aisle on one bar of signal, so
 * the failure modes are not hypothetical. Each one gets its own sentence and
 * its own next move, mirroring MealPhotoCapture's reasoning:
 *
 *   no native module   → the number pad, immediately (see the require below)
 *   permission refused → the number pad, plus how to change it
 *   invalid / misread  → "that didn't read cleanly", not "we don't have it"
 *   not in database    → offer to add it by hand; nothing to wait for
 *   no signal          → retry, because this one IS worth waiting for
 *
 * The manual number pad is not a consolation prize — it is always one tap away
 * even when the camera works, because a crushed or curved barcode is common and
 * a 13-digit number is faster to type than to fight.
 *
 * ── THE NATIVE MODULE ───────────────────────────────────────────────────────
 * `expo-camera` is a declared dependency, so a build made from this commit has
 * it. A DEV CLIENT MADE BEFORE IT DOES NOT, and a bare `import` would throw at
 * module-evaluation time and take the whole Foods screen down with it. Same
 * contract as services/nutrition/MealPhotoCapture.ts: required lazily inside a
 * try/catch, so the worst case is a button that explains itself.
 *
 * The require happens at MODULE scope, not in the component. That is what makes
 * the hooks legal: `CameraStage` is only ever mounted when the module is
 * present, so `useCameraPermissions()` inside it is an unconditional call in a
 * component whose existence is decided before React ever runs.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { CONFIDENCE_LABEL, CONFIDENCE_NOTE } from "@/models/nutrients";
import {
  lookupBarcode,
  type BarcodeCandidate,
  type BarcodeLookupOutcome,
  type SearchableFood,
} from "@/services/nutrition/FoodLookupService";
import { normalizeBarcode } from "@/services/nutrition/OpenFoodFacts";

/** Load expo-camera on demand, tolerating a build that predates it. */
function loadCamera(): typeof import("expo-camera") | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-camera");
  } catch {
    return null;
  }
}

/**
 * Resolved once, for the life of the process. Constant by construction, which
 * is what lets `CameraStage` call hooks unconditionally — see the header.
 */
const ExpoCamera = loadCamera();

/** Whether the camera can open at all in this build. */
export function isBarcodeScannerAvailable(): boolean {
  return ExpoCamera !== null;
}

/**
 * The symbologies asked of the camera.
 *
 * Closed on purpose: these are the GS1 numeric formats Open Food Facts is keyed
 * on. Accepting QR would mean scanning a poster and getting "not found", which
 * blames the database for a question it was never asked.
 *
 * `itf14` earns its place because it is the 14-digit GTIN printed on multipacks
 * and outer cases, and `normalizeBarcode` already accepts that length — asking
 * for it costs nothing and it is the one numeric format a shopper plausibly
 * points a phone at that the first four would silently ignore.
 */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "itf14"] as const;

/**
 * How long a live, focused camera may see nothing before we stop pretending
 * that's normal.
 *
 * A working scanner reads a package in well under a second. Past this the honest
 * message is not "keep trying" — it is that something is wrong with the frame,
 * the light or the build, and the number pad is right there. Without this the
 * failure mode is a black rectangle that never explains itself, which is exactly
 * what this file's header promises never to ship.
 */
const NO_READ_AFTER_MS = 7000;

type Phase =
  | { kind: "scanning" }
  | { kind: "manual" }
  | { kind: "looking-up"; code: string }
  | { kind: "result"; outcome: BarcodeLookupOutcome };

export interface BarcodeScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** A product resolved from Open Food Facts, awaiting the user's confirmation. */
  onPick: (candidate: BarcodeCandidate) => void;
  /**
   * The scan matched something already in the user's foods. The parent decides
   * what "use it" means — open the detail sheet, or log it straight away.
   */
  onUseExisting: (food: SearchableFood) => void;
  /**
   * "Add it myself" from a product the database doesn't have. Carries the code
   * so the manual entry can still be tagged with its barcode and found again.
   */
  onAddManually?: (barcode: string) => void;
}

export function BarcodeScannerSheet({
  visible,
  onClose,
  onPick,
  onUseExisting,
  onAddManually,
}: BarcodeScannerSheetProps) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  const headerTop = Math.max(Spacing.lg, Math.min(insets.top, 24) + Spacing.sm);

  // With no camera in this build there is nothing to scan with, so open on the
  // number pad rather than showing an apology first.
  const [phase, setPhase] = useState<Phase>(
    ExpoCamera ? { kind: "scanning" } : { kind: "manual" },
  );
  const [typed, setTyped] = useState("");

  /**
   * A scanner fires continuously — the same barcode arrives dozens of times a
   * second while it stays in frame. This latch makes the first one the only
   * one, and is cleared only by an explicit "Scan another".
   */
  const claimed = useRef(false);
  /** Abort an in-flight lookup when the sheet closes mid-request. */
  const inFlight = useRef<AbortController | null>(null);

  // Reopening starts clean; closing cancels whatever was still running.
  useEffect(() => {
    if (visible) {
      claimed.current = false;
      setTyped("");
      setPhase(ExpoCamera ? { kind: "scanning" } : { kind: "manual" });
    } else {
      inFlight.current?.abort();
      inFlight.current = null;
    }
  }, [visible]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const resolve = useCallback(async (raw: string) => {
    const code = normalizeBarcode(raw);
    setPhase({ kind: "looking-up", code });

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const outcome = await lookupBarcode({ barcode: code, signal: controller.signal });
    if (controller.signal.aborted) return;

    // A short buzz on a hit is the whole reason a scanner feels fast: it
    // confirms the read before the eye finds the result.
    void Haptics.notificationAsync(
      outcome.status === "found" || outcome.status === "local"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});

    setPhase({ kind: "result", outcome });
  }, []);

  const onScanned = useCallback(
    (code: string) => {
      if (claimed.current) return;
      claimed.current = true;
      void resolve(code);
    },
    [resolve],
  );

  const rescan = useCallback(() => {
    claimed.current = false;
    setTyped("");
    setPhase(ExpoCamera ? { kind: "scanning" } : { kind: "manual" });
  }, []);

  const submitTyped = useCallback(() => {
    const code = normalizeBarcode(typed);
    if (!code) return;
    claimed.current = true;
    void resolve(code);
  }, [typed, resolve]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, paddingTop: headerTop },
          ]}
        >
          <View style={styles.headerText}>
            <AppText variant="headline" weight="700">
              Scan a barcode
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {phase.kind === "looking-up"
                ? "Reading the label…"
                : phase.kind === "manual"
                  ? "Type the number under the barcode"
                  : "Point the camera at the package"}
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        {phase.kind === "scanning" && ExpoCamera ? (
          <CameraStage
            camera={ExpoCamera}
            active={visible}
            onScanned={onScanned}
            onManual={() => setPhase({ kind: "manual" })}
          />
        ) : null}

        {phase.kind === "manual" ? (
          <ManualEntry
            value={typed}
            onChange={setTyped}
            onSubmit={submitTyped}
            canScan={ExpoCamera !== null}
            onScanInstead={() => setPhase({ kind: "scanning" })}
          />
        ) : null}

        {phase.kind === "looking-up" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="subhead" color="secondary" style={styles.centerText}>
              Looking up {phase.code} in Open Food Facts.
            </AppText>
          </View>
        ) : null}

        {phase.kind === "result" ? (
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <ResultView
              outcome={phase.outcome}
              onPick={onPick}
              onUseExisting={onUseExisting}
              onAddManually={onAddManually}
              onRescan={rescan}
              onRetry={() => {
                if (phase.outcome.status === "not-found") return;
                rescan();
              }}
            />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

// ── The camera ──────────────────────────────────────────────────────────────

/**
 * The live viewfinder.
 *
 * Mounted only when the native module exists, so every hook in here is an
 * unconditional call — see the module header. It owns the permission dance
 * because `useCameraPermissions` is the module's own hook and there is nothing
 * to ask for until the camera is actually on screen.
 */
function CameraStage({
  camera,
  active,
  onScanned,
  onManual,
}: {
  camera: NonNullable<typeof ExpoCamera>;
  /** The sheet is on screen. A camera behind a dismissed modal must stop. */
  active: boolean;
  onScanned: (code: string) => void;
  onManual: () => void;
}) {
  const { colors } = useColors();
  const { CameraView, useCameraPermissions } = camera;
  const [permission, requestPermission] = useCameraPermissions();

  /** The preview reported itself alive. Until then a black frame means nothing. */
  const [ready, setReady] = useState(false);
  /** The native view refused to mount — a build/hardware fault, not a bad aim. */
  const [mountError, setMountError] = useState<string | null>(null);
  /** A live camera that has read nothing for a while. See NO_READ_AFTER_MS. */
  const [stalled, setStalled] = useState(false);

  /**
   * Ask once, on arrival.
   *
   * `canAskAgain` is the guard that matters: re-prompting after a hard refusal
   * is a no-op on both platforms, so without it the screen would sit on a
   * spinner forever with no explanation. A refused permission has to become a
   * sentence, not a silence.
   */
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  /**
   * The stall timer, started only once the preview is genuinely running.
   *
   * Anchored on `ready` rather than on mount so a slow camera start is never
   * mistaken for a camera that cannot read — the message this produces claims
   * the frame is live and nothing in it decoded, and it must not be able to
   * make that claim before the frame is live.
   */
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setStalled(true), NO_READ_AFTER_MS);
    return () => clearTimeout(t);
  }, [ready]);

  if (mountError) {
    return (
      <View style={styles.center}>
        <Ionicons name="videocam-off-outline" size={34} color={colors.textTertiary} />
        <AppText variant="headline">The camera didn&apos;t start</AppText>
        <AppText variant="subhead" color="secondary" style={styles.centerText}>
          {mountError}
        </AppText>
        <Button label="Type the number" size="sm" icon="keypad-outline" onPress={onManual} />
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={34} color={colors.textTertiary} />
        <AppText variant="headline">Camera access is off</AppText>
        <AppText variant="subhead" color="secondary" style={styles.centerText}>
          Welliva needs the camera to read a barcode. The picture is never saved
          or uploaded — only the number under the bars is used.
        </AppText>
        <View style={styles.centerActions}>
          {permission.canAskAgain ? (
            <Button label="Allow camera" size="sm" onPress={() => void requestPermission()} />
          ) : (
            <Button
              label="Open Settings"
              size="sm"
              variant="tonal"
              onPress={() => void Linking.openSettings()}
            />
          )}
          <Button
            label="Type the number"
            size="sm"
            variant="ghost"
            icon="keypad-outline"
            onPress={onManual}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        /*
         * `autofocus` defaults to "off" in expo-camera (see its
         * utils/props.ts — `autoFocus = props?.autofocus ?? 'off'`), which is a
         * sane default for a viewfinder and the wrong one for a decoder: a
         * barcode held at arm's length in a fixed-focus frame is soft, and a
         * soft barcode never resolves. Nothing else about this screen changes
         * whether it works; this does.
         */
        autofocus="on"
        /* Stop the session when the sheet is closed rather than leaving a
           camera running behind a dismissed modal. */
        active={active}
        animateShutter={false}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={({ data }) => onScanned(data)}
        onCameraReady={() => setReady(true)}
        onMountError={({ message }) =>
          setMountError(
            message ||
              "The camera module isn't in this build. Type the number instead — it reaches the same database.",
          )
        }
      />

      {/*
        The reticle is decorative — the scanner reads the whole frame, not just
        what is inside the box. It exists because people aim at a target, and
        without one they hold the phone too far back to focus.
      */}
      <View style={styles.reticleWrap} pointerEvents="none">
        <View style={[styles.reticle, { borderColor: alpha("#FFFFFF", 0.9) }]} />
      </View>

      <View style={styles.cameraFooter} pointerEvents="box-none">
        {/*
          Three states, three sentences. "Starting" is not the same as "aim
          here", and neither is the same as "this has been live for seven
          seconds and read nothing" — collapsing them is what turns a broken
          scanner into a rectangle that does nothing.
        */}
        <AppText variant="footnote" style={styles.cameraHint}>
          {!ready
            ? "Starting the camera…"
            : stalled
              ? "Still nothing. Fill the frame with the barcode and give it more light — or type the number, which is never slower than fighting a curved label."
              : "Hold the barcode inside the frame"}
        </AppText>
        {/* Promoted once the scan has plainly failed: the escape hatch stops
            being an alternative and becomes the recommendation. */}
        <Button
          label="Type the number instead"
          size="sm"
          variant={stalled ? "primary" : "tonal"}
          icon="keypad-outline"
          onPress={onManual}
        />
      </View>
    </View>
  );
}

// ── Manual entry ────────────────────────────────────────────────────────────

/**
 * The number pad.
 *
 * Reachable from everywhere and never a dead end. A curved, crushed or
 * shrink-wrapped barcode is common enough that this is a first-class path
 * rather than a fallback, and it is also the only path a user with no working
 * camera has at all.
 */
function ManualEntry({
  value,
  onChange,
  onSubmit,
  canScan,
  onScanInstead,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  canScan: boolean;
  onScanInstead: () => void;
}) {
  const { colors } = useColors();
  const digits = normalizeBarcode(value);
  // Only the four GS1 numeric lengths can possibly resolve; anything else would
  // be a guaranteed round trip to "not found".
  const ready = [8, 12, 13, 14].includes(digits.length);

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <AppText variant="subhead" color="secondary">
        Enter the digits printed under the barcode — usually 8, 12 or 13 of them.
      </AppText>

      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        inputMode="numeric"
        autoFocus={!canScan}
        maxLength={20}
        placeholder="0 12345 67890 5"
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Barcode number"
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: ready ? colors.primary : colors.border,
            color: colors.text,
          },
        ]}
      />

      <Button
        label="Look it up"
        icon="search"
        fullWidth
        disabled={!ready}
        onPress={onSubmit}
        accessibilityHint="Searches Open Food Facts for this barcode"
      />

      {canScan ? (
        <Button
          label="Use the camera instead"
          variant="ghost"
          icon="scan-outline"
          fullWidth
          onPress={onScanInstead}
        />
      ) : (
        <AppText variant="caption" color="tertiary">
          This build has no camera module, so scanning isn&apos;t available yet —
          typing the number works exactly the same.
        </AppText>
      )}
    </ScrollView>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

function ResultView({
  outcome,
  onPick,
  onUseExisting,
  onAddManually,
  onRescan,
  onRetry,
}: {
  outcome: BarcodeLookupOutcome;
  onPick: (c: BarcodeCandidate) => void;
  onUseExisting: (f: SearchableFood) => void;
  onAddManually?: (barcode: string) => void;
  onRescan: () => void;
  onRetry: () => void;
}) {
  const { colors } = useColors();

  switch (outcome.status) {
    /*
     * Rung 1. Worth saying out loud that no lookup happened: it explains the
     * instant result, and it is the visible face of the local-first rule.
     */
    case "local":
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={34} color={colors.success} />
          <AppText variant="headline">Already in your foods</AppText>
          <AppText variant="subhead" color="secondary" style={styles.centerText}>
            {outcome.food.name} — kept exactly as you saved it, including any
            corrections you made.
          </AppText>
          <View style={styles.centerActions}>
            <Button label="Use it" size="sm" onPress={() => onUseExisting(outcome.food)} />
            <Button label="Scan another" size="sm" variant="ghost" onPress={onRescan} />
          </View>
        </View>
      );

    case "found":
      return <FoundProduct candidate={outcome.candidate} onPick={onPick} onRescan={onRescan} />;

    case "invalid":
      return (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.warning} />
          <AppText variant="headline">That didn&apos;t read cleanly</AppText>
          <AppText variant="subhead" color="secondary" style={styles.centerText}>
            The digits failed their own check — it&apos;s a misread, not a missing
            product. Try the scan again, or type the number.
          </AppText>
          <Button label="Try again" size="sm" onPress={onRescan} />
        </View>
      );

    case "not-found":
      return (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={34} color={colors.textTertiary} />
          <AppText variant="headline">Not in the database</AppText>
          <AppText variant="subhead" color="secondary" style={styles.centerText}>
            Open Food Facts has no entry for {outcome.barcode}. It&apos;s an open
            database, so this happens with new and regional products — you can add
            the label yourself and it&apos;ll be yours from then on.
          </AppText>
          <View style={styles.centerActions}>
            {onAddManually ? (
              <Button
                label="Add it myself"
                size="sm"
                icon="create-outline"
                onPress={() => onAddManually(outcome.barcode)}
              />
            ) : null}
            <Button label="Scan another" size="sm" variant="ghost" onPress={onRescan} />
          </View>
        </View>
      );

    case "no-nutrition":
      return (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={34} color={colors.textTertiary} />
          <AppText variant="headline">No label on that entry</AppText>
          <AppText variant="subhead" color="secondary" style={styles.centerText}>
            {outcome.name ? `“${outcome.name}” is ` : "That product is "}
            in Open Food Facts, but nobody has entered its nutrition panel yet.
            There&apos;s nothing to wait for — enter it once and it&apos;s yours.
          </AppText>
          <View style={styles.centerActions}>
            {onAddManually ? (
              <Button
                label="Add it myself"
                size="sm"
                icon="create-outline"
                onPress={() => onAddManually(outcome.barcode)}
              />
            ) : null}
            <Button label="Scan another" size="sm" variant="ghost" onPress={onRescan} />
          </View>
        </View>
      );

    case "failed":
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.textTertiary} />
          <AppText variant="headline">Couldn&apos;t reach the database</AppText>
          <AppText variant="subhead" color="secondary" style={styles.centerText}>
            {outcome.message}
          </AppText>
          <Button label="Try again" size="sm" onPress={onRetry} />
        </View>
      );
  }
}

/**
 * The hit.
 *
 * Everything a scan is FOR is on this card, and so is everything the app owes
 * the user about it: what the product is, what one serving weighs, the macros
 * at that serving, and — never optional — which rung the figures sit on and
 * what that rung means. A branded label is a real measurement and is shown as
 * one; a half-transcribed entry says so in as many words.
 */
function FoundProduct({
  candidate,
  onPick,
  onRescan,
}: {
  candidate: BarcodeCandidate;
  onPick: (c: BarcodeCandidate) => void;
  onRescan: () => void;
}) {
  const { colors } = useColors();
  const strong = candidate.confidence === "measured";
  const tone = strong ? colors.success : colors.warning;
  const kcal = candidate.nutrients.calories;

  return (
    <>
      <View
        style={[
          styles.product,
          { backgroundColor: colors.surface, borderColor: alpha(tone, 0.35) },
        ]}
      >
        <View style={styles.badgeRow}>
          <Ionicons
            name={strong ? "shield-checkmark" : "information-circle"}
            size={14}
            color={tone}
          />
          <AppText variant="caption" weight="700" uppercase style={{ color: tone }}>
            {CONFIDENCE_LABEL[candidate.confidence]}
          </AppText>
        </View>

        <AppText variant="title" weight="700">
          {candidate.name}
        </AppText>

        <AppText variant="subhead" color="secondary">
          {candidate.serving}
          {candidate.servingGrams !== null
            ? ` · ${Math.round(candidate.servingGrams)} g`
            : ""}
        </AppText>

        {kcal !== undefined ? (
          <AppText variant="display" weight="700" style={styles.kcal}>
            {Math.round(kcal)} kcal
          </AppText>
        ) : null}

        <AppText variant="footnote" color="tertiary">
          {`P ${candidate.nutrients.protein ?? 0}g · C ${candidate.nutrients.carbs ?? 0}g · F ${candidate.nutrients.fat ?? 0}g`}
        </AppText>

        {/*
          The receipt. `source.description` carries the barcode itself, so the
          user can check the entry — or fix it — at openfoodfacts.org. This line
          is the reason a scanned number is allowed into a daily total at all.
        */}
        <View style={[styles.receipt, { borderTopColor: colors.divider }]}>
          <AppText variant="caption" color="tertiary">
            {candidate.source.kind === "branded"
              ? `${candidate.source.brand} · ${candidate.source.description}`
              : candidate.source.description}
          </AppText>
          <AppText variant="caption" color="tertiary" style={styles.note}>
            {CONFIDENCE_NOTE[candidate.confidence]}
          </AppText>
        </View>
      </View>

      <Button
        label="Add to my foods"
        icon="add"
        fullWidth
        onPress={() => onPick(candidate)}
        accessibilityHint="Saves this product to your food list so you can log it"
      />
      <Button label="Scan another" variant="ghost" fullWidth onPress={onRescan} />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  body: { padding: Spacing.xl, gap: Spacing.lg },

  cameraWrap: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  reticle: {
    width: "72%",
    aspectRatio: 1.6,
    borderWidth: 2,
    borderRadius: Radius.lg,
  },
  cameraFooter: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: Platform.OS === "ios" ? Spacing.xxl : Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  cameraHint: { color: "#FFFFFF", textAlign: "center" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xxl,
  },
  centerText: { textAlign: "center" },
  centerActions: { flexDirection: "row", gap: Spacing.md, flexWrap: "wrap", justifyContent: "center" },

  input: {
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 20,
    letterSpacing: 2,
  },

  product: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kcal: { marginTop: Spacing.xs },
  receipt: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  note: { lineHeight: 17 },
});
