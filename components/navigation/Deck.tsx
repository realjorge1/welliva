/**
 * THE DECK, ASSEMBLED — see DeckContext.tsx for what it is and why.
 *
 * This file is the one mount point: `DeckHost` wraps the app inside AppDrawer's
 * transformed content, so the Deck rides the drawer's slide and scale with the
 * screen it belongs to, and exists identically on all twelve destinations
 * instead of on the four that happened to remember to render a footer.
 *
 * THREE GATES, AND EACH ONE IS A DIFFERENT KIND OF NO:
 *
 *   · ROUTE — only the menu's own destinations (`SWIPEABLE_PATHS`). A pushed
 *     detail screen, the auth flow, the consent gate and a running guided
 *     session own their own bottom edge; the same rule the drawer's swipe and
 *     the hamburger already follow, so all three agree about where "the app
 *     proper" is.
 *   · KEYBOARD — the rail and dock leave while a keyboard is up, everywhere.
 *     Nobody wants navigation furniture stacked under a composer, and this is
 *     one rule in one place rather than an opt-out each text-entry screen has
 *     to remember. The SHEETS stay mounted through it, because a weigh-in field
 *     raising the keyboard must not unmount the sheet holding it.
 *   · DRAWER — handled for free: the Deck is inside the content view whose
 *     pointer events the drawer already turns off when the menu is out.
 *
 * WHAT THE MODALS TAUGHT US, KEPT. React Native will not present a second Modal
 * over a live one — it simply never appears, with no error, which is what made
 * weigh-in and check-in look dead from inside the old quick-log sheet. Work
 * that opens another modal is parked until the first has actually unmounted
 * (`queue` / `runQueued`); navigation and writes still run on the tap, because
 * routing them through the queue would make them depend on a close animation
 * for no reason at all.
 */

import { MindSheet } from "@/components/mind";
import {
  GozlinActionSheet,
  WeighInModal,
  useQuickLog,
  type ActionSheetOption,
} from "@/components/gozlin";
import { AppText } from "@/components/ui/Text";
import { Sheet } from "@/components/ui/Sheet";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dock } from "./Dock";
import {
  DECK_BASE_GAP,
  DECK_GUTTER,
  DeckProvider,
  FOLD,
  type DeckApi,
} from "./DeckContext";
import { Rail } from "./Rail";
import { COMPACT_RAIL_PATHS, SWIPEABLE_PATHS } from "./menu";
import { WATER_TAP_ML, type NextMove } from "./nextMove";
import { useDeckState } from "./useDeckState";

/** How long a write receipt stays up. Long enough to read, short enough to trust. */
const CONFIRM_MS = 1900;

/* ──────────────────────────────── the host ────────────────────────────── */

export function DeckHost({ children }: { children: React.ReactNode }) {
  /**
   * The fold, as ONE boolean in JS.
   *
   * It could have been a shared value interpolated every frame, and that would
   * have been worse: the rail's folded state is a different SET of objects, not
   * the same ones at different sizes, so what it actually needs is a layout
   * swap — and a swap needs a render anyway. Hysteresis over the reported
   * offset means this flips a handful of times per screenful, not per frame.
   */
  const [folded, setFolded] = useState(false);
  const lastY = useRef(0);
  const anchorY = useRef(0);
  const goingDown = useRef(false);

  const settle = useCallback(() => {
    lastY.current = 0;
    anchorY.current = 0;
    goingDown.current = false;
    setFolded(false);
  }, []);

  const reportScroll = useCallback((y: number) => {
    const prev = lastY.current;
    lastY.current = y;

    // The top of a page is a resting state: whatever the finger was doing, a
    // list near its start shows the full rail. Without this a short list can
    // leave the rail folded with nothing left to scroll back through.
    if (y <= FOLD.alwaysOpenAbove) {
      anchorY.current = y;
      setFolded(false);
      return;
    }

    const down = y > prev;
    if (down !== goingDown.current) {
      // A change of direction re-anchors, so travel is measured from the turn
      // rather than from wherever the list happened to start.
      goingDown.current = down;
      anchorY.current = prev;
    }

    const travel = Math.abs(y - anchorY.current);
    if (down && travel > FOLD.foldAfter) setFolded(true);
    else if (!down && travel > FOLD.openAfter) setFolded(false);
  }, []);

  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useCallback((message: string) => {
    setConfirmation(message);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmation(null), CONFIRM_MS);
  }, []);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const api = useMemo<DeckApi>(
    () => ({ reportScroll, settle, confirm }),
    [reportScroll, settle, confirm],
  );

  return (
    <DeckProvider value={api}>
      {/* `children` is the same element on every fold, so React skips the whole
          app subtree when this component's own state changes. */}
      <View style={styles.flex}>
        {children}
        <DeckSurface folded={folded} settle={settle} confirmation={confirmation} />
      </View>
    </DeckProvider>
  );
}

/* ─────────────────────────────── the gates ────────────────────────────── */

function DeckSurface({
  folded,
  settle,
  confirmation,
}: {
  folded: boolean;
  settle: () => void;
  confirmation: string | null;
}) {
  const pathname = usePathname();
  const onMenuRoute = pathname != null && SWIPEABLE_PATHS.has(pathname);

  // Arriving somewhere must never land you on a folded rail.
  useEffect(() => {
    settle();
  }, [pathname, settle]);

  if (!onMenuRoute) return null;
  return <DeckBody folded={folded} confirmation={confirmation} pathname={pathname} />;
}

/** True while a software keyboard is up. One rule, one place. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    // `will*` on iOS so the rail is gone before the keyboard covers it;
    // Android only fires `did*`, so there it leaves a frame later.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setUp(true));
    const hide = Keyboard.addListener(hideEvent, () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

/* ──────────────────────────────── the body ────────────────────────────── */

function DeckBody({
  folded,
  confirmation,
  pathname,
}: {
  folded: boolean;
  confirmation: string | null;
  pathname: string;
}) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboardUp = useKeyboardUp();
  const quickLog = useQuickLog();

  const {
    live,
    cue,
    agenda,
    more,
    finished,
    progress,
    dismissedCount,
    dismissals,
    todaySession,
    addWater,
    waterMl,
    waterGoalMl,
    //
    // ANY entry today counts as having checked in. The day-progress ring and the
    // check-in nudge both read this flag, and someone who logged three moments
    // this morning has plainly told us how they feel even without a daily
    // summary — keying it on the daily entry alone would keep nudging them.
  } = useDeckState(pathname, quickLog.todayCount > 0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [weighInOpen, setWeighInOpen] = useState(false);

  // The deck's own receipt channel, for writes it makes itself. Screens call
  // the same thing through `useDeck().confirm`.
  const [localConfirm, setLocalConfirm] = useState<string | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useCallback((message: string) => {
    setLocalConfirm(message);
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => setLocalConfirm(null), CONFIRM_MS);
  }, []);
  useEffect(
    () => () => {
      if (localTimer.current) clearTimeout(localTimer.current);
    },
    [],
  );

  /** Work parked until a sheet has actually unmounted — see the header. */
  const pending = useRef<(() => void) | null>(null);
  const queue = useCallback((fn: () => void) => {
    pending.current = fn;
  }, []);
  const runQueued = useCallback(() => {
    const fn = pending.current;
    pending.current = null;
    // Null on a dismissal — scrim, back or drag — which must do nothing.
    fn?.();
  }, []);

  /**
   * The player's launch contract, unchanged — the same parallel id/set/rep
   * lists the Fitness screen's own start button builds.
   */
  const startTodaySession = useCallback(() => {
    if (!todaySession) return;
    router.push({
      pathname: "/guided-session",
      params: {
        exerciseIds: todaySession.exercises.map((e) => e.exerciseId).join(","),
        sessionLabel: todaySession.dayLabel,
        workoutSessionId: todaySession.id,
        sets: todaySession.exercises.map((e) => e.sets).join(","),
        reps: todaySession.exercises.map((e) => e.reps).join(","),
      },
    });
  }, [todaySession, router]);

  const runMove = useCallback(
    (move: NextMove, fromSheet = false) => {
      const action = move.action;
      switch (action.kind) {
        case "resume":
          router.push({ pathname: "/guided-session", params: { resume: "1" } });
          return;
        case "startSession":
          startTodaySession();
          return;
        // A menu destination is a root screen: switch to it, never push, or the
        // hamburger grows a back stack behind it.
        case "route":
          router.navigate(action.href as never);
          return;
        case "push":
          router.push(action.href as never);
          return;
        case "water":
          addWater(action.ml);
          confirm(`${action.ml} ml logged`);
          return;
        // These present a Modal, so from inside a sheet they have to wait.
        case "checkin":
          if (fromSheet) queue(() => setCheckinOpen(true));
          else setCheckinOpen(true);
          return;
        case "weighin":
          if (fromSheet) queue(() => setWeighInOpen(true));
          else setWeighInOpen(true);
          return;
      }
    },
    [router, addWater, startTodaySession, confirm, queue],
  );

  const dismiss = useCallback(
    (move: NextMove) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      dismissals.dismiss(move);
    },
    [dismissals],
  );

  /**
   * Hold the gold action to write a glass of water without opening anything.
   *
   * The power lane under the beginner lane: the sheet is the map for someone
   * learning the app, and this is the shortcut for someone who has already
   * learned it. It is water and not "the last thing you did" on purpose —
   * a hold whose effect changes is a hold nobody dares use.
   */
  const holdAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    addWater(WATER_TAP_ML);
    confirm(`${WATER_TAP_ML} ml logged`);
  }, [addWater, confirm]);

  /** Which quick-log row the hour makes obvious. Lights it; never reorders. */
  const litRow = useMemo(() => {
    const id = cue?.id ?? "";
    if (id.startsWith("log-") || id.startsWith("catchup-")) return "meal";
    if (id === "water") return "water";
    if (id === "start-session" || id === "resume") return "workout";
    if (id === "weighin") return "weighin";
    if (id === "checkin") return "checkin";
    return null;
  }, [cue]);

  /**
   * The fixed half — always these five rows, in this order, on every screen.
   *
   * THE LIST DOES NOT CHANGE WITH THE SCREEN. An earlier version dropped the
   * meal row on Diet and the workout row on Fitness, on the theory that a row
   * leading to the screen you're on is dead weight. In the hand it read as the
   * sheet being broken — the rows you'd learned were simply missing, and the
   * remaining ones looked unresponsive by association. This sheet's second job
   * is to BE the map of what the app can record, and a map that hides the
   * region you're standing in is not a map. `highlight` is the whole extent of
   * what the hour is allowed to change.
   */
  const quickOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "meal",
        label: "Log a meal",
        caption: "Describe it or snap a photo",
        icon: "restaurant-outline",
        navigates: true,
        highlight: litRow === "meal",
        onPress: () => router.push("/diet/log-food" as never),
      },
      {
        key: "water",
        label: "Log water",
        caption: `Add a ${WATER_TAP_ML} ml glass`,
        icon: "water-outline",
        tone: colors.water,
        highlight: litRow === "water",
        // The running total, so the row proves it counted even after the sheet
        // has gone — and shows the number it is about to move.
        badge: `${(waterMl / 1000).toFixed(1)} / ${(waterGoalMl / 1000).toFixed(1)} L`,
        onPress: () => {
          addWater(WATER_TAP_ML);
          confirm(`${WATER_TAP_ML} ml logged`);
        },
      },
      {
        key: "workout",
        label: todaySession ? `Start ${todaySession.focus}` : "Start a workout",
        caption: todaySession
          ? `Today's session · ~${todaySession.totalDurationMinutes} min`
          : "Browse and pick one",
        icon: "barbell-outline",
        tone: colors.protein,
        navigates: true,
        highlight: litRow === "workout",
        onPress: () =>
          todaySession ? startTodaySession() : router.navigate("/exercise" as never),
      },
      {
        key: "weighin",
        label: "Log a weigh-in",
        caption: "Weight, waist & goal",
        icon: "scale-outline",
        tone: colors.fat,
        highlight: litRow === "weighin",
        onPress: () => queue(() => setWeighInOpen(true)),
      },
      {
        key: "checkin",
        // "Check in" stays the label — a momentary entry is always available, so
        // the row is never "already done" the way the old one-per-day check-in
        // was. The count goes in the caption instead of turning the label into
        // "Update", which would have hidden the fact that you can log again.
        label: "Check in",
        caption:
          quickLog.todayCount > 0
            ? `${quickLog.todayCount} logged today · how you feel`
            : "How you feel, and what it's about",
        icon: "partly-sunny-outline",
        tone: colors.calories,
        highlight: litRow === "checkin",
        onPress: () => queue(() => setCheckinOpen(true)),
      },
    ],
    [
      router,
      addWater,
      colors,
      quickLog.todayCount,
      todaySession,
      startTodaySession,
      queue,
      confirm,
      waterMl,
      waterGoalMl,
      litRow,
    ],
  );

  /**
   * The cue rides in the rail while folded, and in the dock while not — one
   * prompt, never two. This is the whole reason the folded rail has a middle:
   * the space three labels give up is exactly the space one sentence needs.
   */
  //
  // On the compact destinations (Habits, Logs, Upgrade, Settings, Profile) the
  // rail is held in that folded shape — Home, prompt, action — and never shows
  // its tabs. Its middle must always say something, so the prompt falls back
  // to a session in flight, then to the finished-day sentence, which is total.
  // The sentence ignores its "not now" lease here: that lease quiets the dock
  // card, and a blank pill in the middle of the rail would read as broken.
  const compact = COMPACT_RAIL_PATHS.has(pathname);
  const railFolded = compact || folded;
  const inlineCue = compact ? (cue ?? live ?? finished) : folded ? cue : null;
  const dockCue = railFolded ? null : cue;
  // A session carried by the rail's pill is not also drawn as a controller.
  const dockLive = live && inlineCue === live ? null : live;
  // The finished-day sentence only ever stands alone, and only until waved away.
  const dockFinished =
    !compact && !live && !cue && !dismissals.isDismissed(finished.id) ? finished : null;

  return (
    <>
      {!keyboardUp && (
        <View
          style={[
            styles.deck,
            { paddingBottom: insets.bottom + DECK_BASE_GAP },
          ]}
          pointerEvents="box-none"
        >
          <Dock
            live={dockLive}
            cue={dockCue}
            finished={dockFinished}
            more={more}
            confirmation={localConfirm ?? confirmation}
            onRun={runMove}
            onDismiss={dismiss}
            onExpand={() => {
              Haptics.selectionAsync().catch(() => {});
              setAgendaOpen(true);
            }}
          />
          <Rail
            folded={railFolded}
            inlineCue={inlineCue}
            onCue={() => inlineCue && runMove(inlineCue)}
            onAction={() => {
              Haptics.selectionAsync().catch(() => {});
              setSheetOpen(true);
            }}
            onActionHold={holdAction}
          />
        </View>
      )}

      <GozlinActionSheet
        visible={sheetOpen}
        title="Quick log"
        subtitle="Everything Welliva keeps track of, in one place."
        options={quickOptions}
        onClose={() => setSheetOpen(false)}
        onClosed={runQueued}
      />

      <AgendaSheet
        visible={agendaOpen}
        moves={agenda}
        done={progress.done}
        total={progress.total}
        dismissedCount={dismissedCount}
        onClose={() => setAgendaOpen(false)}
        onClosed={runQueued}
        onPick={(move) => {
          setAgendaOpen(false);
          runMove(move, true);
        }}
        onDismiss={dismiss}
        onRestoreAll={() => void dismissals.clear()}
      />

      <MindSheet
        visible={checkinOpen}
        existing={quickLog.todayCheckin}
        onClose={() => setCheckinOpen(false)}
        onSave={quickLog.saveCheckin}
      />

      <WeighInModal
        visible={weighInOpen}
        currentWeightKg={quickLog.currentWeightKg}
        goalWeightKg={quickLog.goalWeightKg}
        onClose={() => setWeighInOpen(false)}
        onSave={quickLog.saveWeighIn}
      />
    </>
  );
}

/* ─────────────────────────────── the agenda ───────────────────────────── */

/**
 * The cue, pulled up.
 *
 * WHAT IT IS FOR. The ladder always knew there were four things open and only
 * ever said one of them, which is what made a correct suggestion read as bossy.
 * This is the app showing its working: here is everything today still wants,
 * in the order it would do them, and you may take any of them or none.
 *
 * THE HEADER PRINTS THE RING'S NUMBER IN WORDS. "3 of 6 done today" is exactly
 * `resolveDayProgress`, the same two numbers the Home tab's ring draws — so the
 * one counter in the Deck that has no label gets one, here, and the standing
 * rule that anything claiming to count must count exactly that is satisfied in
 * the place a person would go to check.
 *
 * DISMISSAL IS A BUTTON HERE, NOT A SWIPE. Inside a sheet that already drags to
 * close, a horizontal swipe on a row is a coin toss; an explicit control is not.
 */
function AgendaSheet({
  visible,
  moves,
  done,
  total,
  dismissedCount,
  onClose,
  onClosed,
  onPick,
  onDismiss,
  onRestoreAll,
}: {
  visible: boolean;
  moves: NextMove[];
  done: number;
  total: number;
  dismissedCount: number;
  onClose: () => void;
  onClosed: () => void;
  onPick: (move: NextMove) => void;
  onDismiss: (move: NextMove) => void;
  onRestoreAll: () => void;
}) {
  const { colors } = useColors();

  const header = (
    <View style={styles.agendaHeader}>
      <AppText variant="headline">Today</AppText>
      <AppText variant="footnote" color="tertiary" style={styles.agendaSub}>
        {total > 0
          ? `${done} of ${total} done · ${moves.length} still open`
          : `${moves.length} open`}
      </AppText>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} onClosed={onClosed} header={header}>
      <View style={styles.agendaList}>
        {moves.map((move) => (
          <View key={move.id} style={styles.agendaRow}>
            <Pressable
              onPress={() => onPick(move)}
              accessibilityRole="button"
              accessibilityLabel={
                move.caption ? `${move.label}. ${move.caption}` : move.label
              }
              style={({ pressed }) => [
                styles.agendaMain,
                pressed && { backgroundColor: alpha(colors.text, 0.06) },
              ]}
            >
              <View
                style={[
                  styles.agendaPlate,
                  { backgroundColor: alpha(colors.primary, 0.14) },
                ]}
              >
                <Ionicons name={move.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyLg" weight="600" numberOfLines={1}>
                  {move.label}
                </AppText>
                {move.caption ? (
                  <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                    {move.caption}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>

            {move.dismissible ? (
              <Pressable
                onPress={() => onDismiss(move)}
                accessibilityRole="button"
                accessibilityLabel={`Put off ${move.label}`}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.agendaDismiss,
                  { borderColor: colors.border },
                  pressed && { backgroundColor: alpha(colors.text, 0.06) },
                ]}
              >
                <AppText variant="caption" weight="700" color="tertiary">
                  Not now
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ))}

        {moves.length === 0 ? (
          <View style={styles.agendaEmpty}>
            <AppText variant="body" color="secondary">
              Nothing open. That is the whole list.
            </AppText>
          </View>
        ) : null}

        {dismissedCount > 0 ? (
          <Pressable
            onPress={onRestoreAll}
            accessibilityRole="button"
            accessibilityLabel={`Bring back ${dismissedCount} put off today`}
            style={({ pressed }) => [
              styles.agendaRestore,
              { borderColor: colors.border },
              pressed && { backgroundColor: alpha(colors.text, 0.06) },
            ]}
          >
            <Ionicons name="arrow-undo-outline" size={15} color={colors.textTertiary} />
            <AppText variant="footnote" color="tertiary">
              {dismissedCount} put off today · bring back
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  deck: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: DECK_GUTTER,
  },

  agendaHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  agendaSub: { marginTop: 2 },

  agendaList: { gap: 2 },
  agendaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  agendaMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
  },
  agendaPlate: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  agendaDismiss: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    marginRight: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  agendaEmpty: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  agendaRestore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
