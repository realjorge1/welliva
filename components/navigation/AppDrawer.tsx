/**
 * APP DRAWER — the shell the whole app lives inside.
 *
 * Structurally there are only three layers: the menu panel pinned to the left,
 * the app itself on top of it, and a scrim between them. Opening the drawer
 * doesn't mount or unmount anything — it just moves the app to the right,
 * shrinks it a little, and rounds its corners, which is why it can be dragged.
 *
 * THE DIVISION OF LABOUR (the two things this was asked to get right):
 *
 *   · GESTURE HANDLER tracks the finger. A pan that only claims the touch when
 *     it starts within `EDGE_HIT_WIDTH` of the left edge (or when the drawer is
 *     already out), with `activeOffsetX`/`failOffsetY` so a vertical scroll or a
 *     horizontal carousel inside a screen still wins its own gesture.
 *   · REANIMATED does every pixel of movement, scale and opacity, off ONE shared
 *     value on the UI thread. React re-renders exactly twice per open/close —
 *     once for pointer-events, once for accessibility — and never during a drag.
 *
 * WHERE THE SWIPE IS LIVE. Only on the menu's own destinations
 * (`SWIPEABLE_PATHS`). Pushed detail screens keep their native swipe-back, the
 * auth flow and the consent gate keep their hands free, and a running guided
 * session can't be swiped out from under the user. The hamburger follows the
 * same rule by simply not being rendered on those screens.
 */

import * as Haptics from "@/utils/haptics";
import { usePathname, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useColors } from "@/components/ui/useColors";
import {
  CONTENT_RADIUS,
  CONTENT_SCALE,
  DRAWER_SPRING,
  DrawerProvider,
  EDGE_HIT_WIDTH,
  FLICK_PROJECTION,
  MENU_SURFACE,
  SCRIM_OPACITY,
  menuWidthFor,
  type DrawerApi,
} from "./DrawerContext";
import { SideMenu } from "./SideMenu";
import { SWIPEABLE_PATHS, type MenuItem } from "./menu";

/**
 * THE COLD-START LATCH for the menu's entrance bounce.
 *
 * Module scope, deliberately: this lives as long as the JS runtime does, which
 * is exactly the lifetime we were asked for. Kill the app and relaunch it and
 * the runtime is new, so the bounce plays once more; background it and come
 * back and the runtime survived, so the menu just opens. A ref or state would
 * be per-mount (wrong on a remount), and storage would persist across launches
 * (wrong the other way) — the JS session IS the unit here.
 */
let introPending = true;

export function AppDrawer({ children }: { children: React.ReactNode }) {
  const { colors } = useColors();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();

  const menuWidth = useMemo(() => menuWidthFor(width), [width]);

  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);

  // Where the drag started, so a drag that begins mid-animation continues from
  // where the drawer actually is rather than snapping to the finger.
  const startProgress = useSharedValue(0);

  const swipeEnabled = SWIPEABLE_PATHS.has(pathname);

  /* ── Imperative API ─────────────────────────────────────────────────── */

  // Flip React state at the START of the animation, not the end: the drawer
  // must stop swallowing touches the instant it begins closing.
  const settle = useCallback(
    (to: 0 | 1) => {
      setIsOpen(to === 1);
      Haptics.selectionAsync().catch(() => {});
      progress.value = withSpring(to, DRAWER_SPRING);
    },
    [progress],
  );

  const open = useCallback(() => settle(1), [settle]);
  const close = useCallback(() => settle(0), [settle]);
  const toggle = useCallback(() => settle(isOpen ? 0 : 1), [settle, isOpen]);

  /** Called from the gesture's UI-thread end handler — the spring is already
   *  running by then, so this only syncs React and fires the haptic. */
  const syncOpen = useCallback((next: boolean) => {
    setIsOpen((prev) => {
      if (prev !== next) Haptics.selectionAsync().catch(() => {});
      return next;
    });
  }, []);

  /* ── First open of the session gets the entrance bounce ─────────────── */

  // Flips exactly once per launch, at the START of the first open (`isOpen` is
  // set before the spring runs), so the rows are still invisible when the
  // cascade is armed. It never flips back: SideMenu keys the animation on the
  // 0 → 1 edge, so every later open is a plain reveal.
  const [playIntro, setPlayIntro] = useState(false);
  useEffect(() => {
    if (!isOpen || !introPending) return;
    introPending = false;
    setPlayIntro(true);
  }, [isOpen]);

  /* ── Android back closes the drawer before it leaves the screen ─────── */

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  /* ── Any navigation closes it ───────────────────────────────────────── */

  // Covers the routes we don't drive ourselves: a notification deep link, a
  // paywall redirect, the auth gate. `close()` is idempotent, so the menu's own
  // navigation calling it twice costs nothing.
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  useEffect(() => {
    if (openRef.current) close();
    // Deliberately keyed on the path alone — adding `isOpen` here would fire the
    // effect the moment the drawer opens and slam it shut again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ── Menu navigation ────────────────────────────────────────────────── */

  const onNavigate = useCallback(
    (item: MenuItem) => {
      close();
      if (item.href === pathname) return;

      // Land on the root screen, never underneath a pushed detail view or a
      // modal. Every menu destination is a screen in the (tabs) navigator, so
      // after dismissing, `navigate` is a tab switch — no push, no back stack.
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // canDismiss throws when there is no stack to ask; nothing to dismiss.
      }
      router.navigate(item.href as never);
    },
    [close, pathname, router],
  );

  /* ── Gestures ───────────────────────────────────────────────────────── */

  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .enabled(swipeEnabled)
      // Horizontal intent only, and never at the expense of a vertical
      // scroll — `failOffsetY` hands the touch straight back to the list.
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        startProgress.value = progress.value;
      })
      .onUpdate((e) => {
        const next = startProgress.value + e.translationX / menuWidth;
        progress.value = Math.min(1, Math.max(0, next));
      })
      .onEnd((e) => {
        // Project the flick forward so a fast, short swipe still resolves the
        // way it was clearly meant to.
        const projected =
          progress.value + (e.velocityX / menuWidth) * FLICK_PROJECTION;
        const toOpen = projected > 0.5;
        progress.value = withSpring(toOpen ? 1 : 0, DRAWER_SPRING);
        runOnJS(syncOpen)(toOpen);
      });

    // OPENING IS AN EDGE SWIPE; CLOSING CAN START ANYWHERE.
    //
    // This is a `hitSlop`, not a check inside the handler, and the difference
    // matters. Restricting the region means the closed drawer's pan never even
    // BEGINS outside the edge strip — so a horizontal carousel (Home's coach
    // deck, the Foods group chips) and every list keeps its own gesture
    // untouched. Deciding inside `onUpdate` would have let the pan activate
    // first and cancel those touches on its way to doing nothing.
    return isOpen ? g : g.hitSlop({ left: 0, width: EDGE_HIT_WIDTH });
  }, [isOpen, menuWidth, progress, startProgress, swipeEnabled, syncOpen]);

  // Tapping the dimmed app puts it back. Lives on the scrim rather than the root
  // so it can never compete with a button inside a screen.
  const tapToClose = useMemo(
    () => Gesture.Tap().onEnd((_e, success) => {
      if (success) runOnJS(close)();
    }),
    [close],
  );

  /* ── Animated styles ────────────────────────────────────────────────── */

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [0, menuWidth],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, CONTENT_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [0, CONTENT_RADIUS],
      Extrapolation.CLAMP,
    ),
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0, SCRIM_OPACITY],
      Extrapolation.CLAMP,
    ),
  }));

  const api = useMemo<DrawerApi>(
    () => ({ progress, isOpen, open, close, toggle }),
    [progress, isOpen, open, close, toggle],
  );

  return (
    <DrawerProvider value={api}>
      <GestureDetector gesture={pan}>
        {/* Matches the panel, so an overshooting spring can never flash a
            different colour in the sliver beyond the menu's right edge. */}
        <View style={[styles.root, { backgroundColor: MENU_SURFACE }]}>
          <SideMenu
            progress={progress}
            width={menuWidth}
            activePath={pathname}
            onNavigate={onNavigate}
            playIntro={playIntro}
          />

          <Animated.View
            style={[styles.content, { backgroundColor: colors.background }, contentStyle]}
          >
            <View
              style={styles.flex}
              // While the menu is out the app underneath is a picture, not a
              // surface: no stray taps, and nothing for a screen reader to find.
              pointerEvents={isOpen ? "none" : "auto"}
              accessibilityElementsHidden={isOpen}
              importantForAccessibility={isOpen ? "no-hide-descendants" : "auto"}
            >
              {children}
            </View>

            {/* Inside the content, so it dims and travels with the app and
                never touches the panel. */}
            <Animated.View
              style={[styles.scrim, scrimStyle]}
              pointerEvents={isOpen ? "auto" : "none"}
            >
              <GestureDetector gesture={tapToClose}>
                <View
                  style={styles.flex}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                />
              </GestureDetector>
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  content: {
    flex: 1,
    // Clips the app's own full-bleed gradients to the rounded corners as it
    // lifts. Without this the canvas keeps its square edges and the "card"
    // illusion falls apart at the top.
    overflow: "hidden",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
});
