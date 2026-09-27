/**
 * AuthKit — the sign-in surface, rebuilt as a hero + bottom sheet.
 *
 * ── WHAT CHANGED AND WHY ────────────────────────────────────────────────────
 * The old auth screen was a centred form on a gradient: logo, wordmark,
 * tagline, two boxed fields, a pill, then social buttons as bare circles under
 * an "or continue with" rule. It read as a 2019 login form, and it asked the
 * slowest question first — type an address and a password — while the fast way
 * in sat at the bottom, unlabelled.
 *
 * This is the inversion. The screen is now one full-bleed HERO with a dark
 * SHEET lifted over its bottom edge, and the sheet carries the whole decision:
 * a short greeting, one line saying what the choice is, then full-width
 * provider rows in the order people actually use them. Email is still here —
 * see `AuthEmailToggle` — but it is a disclosure, not the default posture.
 *
 * ── THE PIECES ──────────────────────────────────────────────────────────────
 *   <AuthScreen>        canvas + hero + header + the sheet's frame
 *     <AuthSheetTitle>  "Welcome back!" + the one-line instruction
 *     <AuthTrustNote>   optional: the private-by-default reassurance block
 *     <SocialSignInRow> the provider rows (which ones is a server answer)
 *     <AuthEmailToggle> the disclosure that reveals the email form
 *     <AuthField> ×n    the email form itself
 *     <AuthLegalStrip>  the gold band welded to the sheet's foot
 *
 * ── WHAT IS DELIBERATE ──────────────────────────────────────────────────────
 * · Buttons are full-width ROWS carrying the provider's name, not bare glyphs.
 *   A circle with a "G" in it is a guess; "Continue with Google" is not.
 * · The Google mark is the real four-colour G (drawn, not a monochrome font
 *   glyph) because the brand guidelines require the colour version on a dark
 *   ground, and Ionicons only has the silhouette.
 * · Apple gets the white treatment its own guidelines mandate — and only
 *   appears when the project has the provider on (see socialProviders.ts).
 * · The legal strip is a band, not a caption: it is the last thing above the
 *   home indicator and it must survive on a sheet of any height.
 *
 * The surface is theme-agnostic on purpose. Auth is a fixed branded moment; it
 * does not follow the app's light/dark setting.
 */
import { visibleProviders } from "@/components/auth/signInMethods";
import { useSocialProviders } from "@/components/auth/socialProviders";
import { OrbField, useOrbTouch } from "@/components/OrbField";
import { enterFade, exitFade } from "@/components/motion";
import { useKeyboardInset } from "@/components/ui";
import { brandGradientDark } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

/* ────────────────────────────── Surface tokens ──────────────────────────────
 * Local, not from constants/theme: those tokens follow the user's light/dark
 * setting, and this surface is a fixed dark brand moment that must not.
 */

/** The page behind everything. Pure black so the sheet and hero both lift off it. */
const CANVAS = "#000000";
/** The sheet itself — near-black, one step up from the canvas so its edge reads. */
const SHEET = "#141414";
/** Provider rows on the sheet: a shade up again, with a hairline to define them. */
const ROW_DARK = "#1F1F1F";
const HAIRLINE = "rgba(255,255,255,0.10)";
/** The dark-mode brand yellow — the gold pill, links, the hero's orbs. */
const GOLD = brandGradientDark[0]; // #F6CF54
/** Near-black with a warm cast — legible ink on top of the brand gold. */
const INK = "#1C1206";
const WHITE = "#FFFFFF";
const WHITE_52 = "rgba(255,255,255,0.52)";
const WHITE_40 = "rgba(255,255,255,0.40)";
/** Soft warm red for inline validation / auth errors, legible on the dark sheet. */
const ERROR_TINT = "#FF9E9E";
/** Facebook blue, as the brand guidelines specify it. */
const FACEBOOK_BLUE = "#1877F2";

/** Every tappable row on this surface is the same height and the same corner. */
const ROW_HEIGHT = 54;
const ROW_RADIUS = 14;
/** The sheet's top corners. Large enough to read as a sheet, not a panel. */
const SHEET_RADIUS = 28;

/**
 * The real app icon — the same artwork app.json ships as the launcher icon. The
 * 512 raster is already bundled, so reusing it is free.
 *
 * Its ground is near-black and square, and on the brown hero that square read
 * as a plate. So the hero never shows the raw square: it crops the art to a
 * disc (see `styles.markArt`), and the disc becomes the innermost ring of the
 * halo ladder.
 */
const APP_ICON = require("@/assets/images/welliva512.png");

/**
 * Where the mark sits inside APP_ICON, measured off the raster. The ring's
 * centre is NOT the image's centre — it rides 41px high — and its glow reaches
 * 156px out from that centre. The crop is computed from these numbers so the
 * ring lands dead-centre in its disc, concentric with the halos, rather than
 * riding high the way a plain rounded square would.
 */
const ICON_ART = { size: 512, cx: 255, cy: 215, glow: 156 };
/** The icon's own ground, sampled off the raster. The disc paints it too, so a crop edge can never show. */
const ICON_GROUND = "#060505";

/**
 * The halo ladder: the mark's disc, then three rings each a fixed step wider.
 *
 * Together they walk the hero's brown down to the icon's black. Each ring lays
 * a little more black over the one outside it — 25%, then a third, then a half —
 * so the shade reads 25% → 50% → 75% dark and then the icon's own ground, with
 * no step bigger than the next. Translucent black rather than four hand-picked
 * browns, so every band tracks the diagonal gradient underneath it instead of
 * matching one point of it.
 *
 * The hairlines climb the other way, bronze → gold, leading the eye in to the
 * mark's own gold ring.
 */
const MARK_DISC = 88;
const HALO_STEP = 48;
/** How much of the disc's radius the mark's glow may fill. */
const MARK_FILL = 0.9;
const markScale = ((MARK_DISC / 2) * MARK_FILL) / ICON_ART.glow;

/* ───────────────────────────────── The hero ─────────────────────────────── */

/**
 * The full-bleed visual the sheet sits over.
 *
 * ONE named component away from being art direction's problem rather than
 * engineering's: swap this body for an <Image contentFit="cover" /> and
 * everything below it still composes — the scrim, the sheet overlap and the
 * header chrome are all independent of what fills this box. Until there is a
 * photograph worth shipping, the hero is built from the brand: a warm gradient,
 * the drifting orb field the onboarding ritual already uses, and the app mark
 * at the centre of a ladder of halos that darkens the brown down to its black.
 *
 * The bottom of the box is a transparent→black scrim. That is what lets the
 * sheet's rounded shoulders land on something dark no matter what the hero is,
 * so the seam never depends on the image.
 */
function AuthHero({
  height,
  touch,
}: {
  height: number;
  touch: ReturnType<typeof useOrbTouch>["touch"];
}) {
  const mark = useSharedValue(0);

  useEffect(() => {
    mark.value = withTiming(1, { duration: 900 });
  }, [mark]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.92 + mark.value * 0.08 }],
  }));

  return (
    <View style={[styles.hero, { height }]} pointerEvents="none">
      <LinearGradient
        colors={["#241405", "#3A2109", "#160C03"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <OrbField color={GOLD} touch={touch} />

      <View style={styles.heroStage}>
        <Animated.View style={markStyle}>
          {/* Nested rings rather than a shadow: a glow behind a raster mark
              renders as a grey box on Android, a ring does not. */}
          <View style={[styles.halo, styles.haloOuter]}>
            <View style={[styles.halo, styles.haloMid]}>
              <View style={[styles.halo, styles.haloInner]}>
                <View style={styles.markDisc}>
                  <Image source={APP_ICON} style={styles.markArt} contentFit="cover" />
                  {/* The edge is its own layer, drawn after the art: a border on
                      the clipping view itself would sit UNDER the image. */}
                  <View style={styles.markEdge} />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* The seam. Sized in proportion so a short screen still gets a full fade. */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", CANVAS]}
        locations={[0, 0.55, 1]}
        style={[styles.heroScrim, { height: Math.round(height * 0.42) }]}
      />
    </View>
  );
}

/* ──────────────────────────────── The chrome ────────────────────────────── */

/**
 * The header bar: a dismiss control on the left, the app's name centred.
 *
 * The dismiss control is drawn ONLY when there is somewhere to go back to.
 * Sign-in is the root of the signed-out stack (AuthWrapper redirects there and
 * nothing sits behind it), so on that screen a close button would be a button
 * that does nothing — the one thing a close button must never be. On sign-up
 * and verify-email, both pushed from sign-in, it is real and it appears.
 */
function AuthHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canDismiss = router.canGoBack();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.headerSlot}>
        {canDismiss && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressedDim]}
          >
            <Ionicons name="chevron-back" size={20} color={WHITE} />
          </Pressable>
        )}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSlot} />
    </View>
  );
}

/* ───────────────────────────────── The screen ───────────────────────────── */

/**
 * The whole auth canvas: hero behind, chrome above, sheet at the foot.
 *
 * The sheet is pinned to the bottom by a `flexGrow` scroll container rather
 * than by absolute positioning, so one component handles both shapes the screen
 * takes: the short one (three provider rows — hero fills, sheet rests on the
 * bottom edge) and the tall one (the email form revealed — the spacer collapses
 * and the whole column scrolls). No height is measured and no branch is taken;
 * flex does it.
 *
 * KEYBOARD. `KeyboardAvoidingView` is dead in this app — edge-to-edge makes
 * Android's `adjustResize` a no-op — so the column insets itself with
 * `useKeyboardInset`, locked to the system's own keyboard animation. Same
 * mechanism the onboarding container uses.
 */
export function AuthScreen({ title, children }: { title: string; children: React.ReactNode }) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Touch observers for the orb field: any press or swipe that lands on an orb
  // bounces it, without ever claiming the responder away from the form.
  const { touch, touchHandlers } = useOrbTouch();
  const kb = useKeyboardInset();

  // The hero runs to just past halfway and the sheet's shoulders overlap it.
  // Proportional rather than fixed so a small phone doesn't lose the sheet and
  // a tall one doesn't strand it.
  const heroHeight = Math.round(screenHeight * 0.58);

  return (
    <View style={styles.canvas} {...touchHandlers}>
      <AuthHero height={heroHeight} touch={touch} />

      <Animated.View style={[styles.flex, kb.containerStyle]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* The chrome's own footprint, so nothing scrolls under the header. */}
          <View style={{ height: insets.top + 52 }} />
          {/* Breathing room above the sheet. Collapses first when space runs out. */}
          <View style={styles.heroSpacer} />

          {/* `layout` is what makes the disclosure feel like the sheet growing
              rather than the sheet jumping: the form fades in while this
              animates the height change in the same beat. */}
          <Animated.View layout={LinearTransition.duration(220)} style={styles.sheet}>
            <View style={styles.handle} />
            {children}
          </Animated.View>
        </ScrollView>
      </Animated.View>

      <AuthHeader title={title} />
    </View>
  );
}

/* ──────────────────────────── Sheet contents ────────────────────────────── */

/**
 * The greeting. Left-aligned and set tight: this is the sheet's own voice, and
 * centring it would make it compete with the hero rather than answer it.
 */
export function AuthSheetTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sheetHead}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.sheetSubtitle}>{subtitle}</Text>
    </View>
  );
}

/**
 * The reassurance block — a mark, a claim, and the sentence that backs it.
 *
 * It sits between the greeting and the provider rows because that is the moment
 * the question is actually live: the user is about to hand over an identity.
 * Saying it afterwards is saying it too late, and saying it in the legal strip
 * is saying it where nobody reads.
 *
 * The claim must stay true to what the Trust screen (app/(tabs)/privacy) says.
 * If the two ever disagree, this one is the lie — it is the one seen first and
 * trusted most.
 */
export function AuthTrustNote({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.trust}>
      <View style={styles.trustMark}>
        <Ionicons name="lock-closed" size={17} color={GOLD} />
      </View>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustBody}>{body}</Text>
    </View>
  );
}

/**
 * Google's four-colour G, drawn.
 *
 * Ionicons' `logo-google` is a single-colour silhouette, which Google's brand
 * guidelines do not permit as the button mark. These are the official paths at
 * the standard 48×48 viewBox.
 */
function GoogleMark({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

/**
 * One provider row.
 *
 * `light` is the white treatment Apple's Human Interface Guidelines require for
 * Sign in with Apple on a dark background; `dark` is everything else. The mark
 * is passed in rather than named, because Google's is an SVG and the others are
 * font glyphs, and the row should not have to know the difference.
 */
function ProviderRow({
  mark,
  label,
  variant,
  loading,
  onPress,
  disabled,
}: {
  mark: React.ReactNode;
  label: string;
  variant: "dark" | "light";
  loading?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const light = variant === "light";
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.row,
        light ? styles.rowLight : styles.rowDark,
        pressed && styles.pressedRow,
        (disabled || loading) && styles.rowDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={light ? INK : WHITE} />
      ) : (
        <>
          <View style={styles.rowMark}>{mark}</View>
          <Text style={[styles.rowLabel, light && styles.rowLabelLight]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Which social sign-in is mid-flight, so only that row shows a spinner. */
export type PendingSocial = "google" | "apple" | "facebook" | null;

/**
 * The provider stack.
 *
 * WHICH rows exist takes two yeses. `useSocialProviders` asks the Supabase
 * project what it has enabled, so a provider that would fail with "provider is
 * not enabled" is never drawn; `visibleProviders` then drops anything we have
 * chosen not to offer (components/auth/signInMethods.ts). That is why Apple can
 * be built here and stay invisible until the entitlement, the dashboard toggle
 * and the offer are all real.
 *
 * Renders nothing when no provider survives both, so the email form (when it is
 * offered) stands alone rather than under an empty heading.
 */
export function SocialSignInRow({
  onGoogle,
  onApple,
  onFacebook,
  pending,
  disabled,
}: {
  onGoogle: () => void;
  onApple?: () => void;
  onFacebook: () => void;
  pending: PendingSocial;
  disabled?: boolean;
}) {
  const providers = visibleProviders(useSocialProviders());
  const showApple = providers.apple && !!onApple;
  if (!providers.google && !showApple && !providers.facebook) return null;

  return (
    <View style={styles.providerStack}>
      {providers.google && (
        <ProviderRow
          mark={<GoogleMark />}
          label="Continue with Google"
          variant="dark"
          loading={pending === "google"}
          onPress={onGoogle}
          disabled={disabled}
        />
      )}
      {showApple && (
        <ProviderRow
          mark={<Ionicons name="logo-apple" size={19} color="#000000" />}
          label="Sign in with Apple"
          variant="light"
          loading={pending === "apple"}
          onPress={onApple!}
          disabled={disabled}
        />
      )}
      {providers.facebook && (
        <ProviderRow
          mark={<Ionicons name="logo-facebook" size={19} color={FACEBOOK_BLUE} />}
          label="Continue with Facebook"
          variant="dark"
          loading={pending === "facebook"}
          onPress={onFacebook}
          disabled={disabled}
        />
      )}
    </View>
  );
}

/**
 * The gold pill — the sheet's one committing action.
 *
 * There is at most one of these on screen at a time. It is what the user presses
 * when the decision has already been made (submit the email form, resend the
 * link); the provider rows above are choices, and choices are not gold.
 */
export function AuthPrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.025 }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={() => {
          if (disabled || loading) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onPress();
        }}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 140 });
        }}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        style={(disabled || loading) && styles.rowDisabled}
      >
        <LinearGradient
          colors={brandGradientDark}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.goldRow}
        >
          {loading ? <ActivityIndicator color={INK} /> : <Text style={styles.goldLabel}>{label}</Text>}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The disclosure that reveals the email form.
 *
 * Deliberately the quietest control on the sheet, and deliberately still here.
 * Every account created before this redesign is an email account, and a
 * social-only sheet would lock those users out of their own data — so email is
 * demoted, never removed.
 */
export function AuthEmailToggle({
  open,
  onPress,
  label,
}: {
  open: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      hitSlop={8}
      style={({ pressed }) => [styles.emailToggle, pressed && styles.pressedDim]}
    >
      <Text style={styles.emailToggleText}>{label}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={WHITE_52} />
    </Pressable>
  );
}

/**
 * Wraps the revealed email form so it shares the sheet's gutter — and fades it
 * in and out as the disclosure opens.
 *
 * Reanimated rather than `LayoutAnimation`: this app runs the New Architecture,
 * where LayoutAnimation is at best unreliable, and `entering`/`exiting` plus the
 * sheet's `layout` transition is the idiom the rest of the codebase already
 * uses (see components/motion/motion.ts).
 */
export function AuthFormBlock({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={enterFade()} exiting={exitFade()} style={styles.formBlock}>
      {children}
    </Animated.View>
  );
}

/** A field on the sheet. Flat, dark, and the same height as the provider rows. */
export function AuthField({
  icon,
  secure,
  onToggleSecure,
  showSecureToggle,
  ...rest
}: TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  showSecureToggle?: boolean;
  onToggleSecure?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={WHITE_40} style={styles.fieldIcon} />
      <TextInput
        style={styles.input}
        placeholderTextColor={WHITE_40}
        secureTextEntry={secure}
        {...rest}
      />
      {showSecureToggle && (
        <Pressable
          onPress={onToggleSecure}
          hitSlop={10}
          accessibilityRole="button"
          // A bare glyph announces nothing without this, and the label has to
          // name the ACTION, not the state — "eye icon" tells a screen-reader
          // user neither what it does nor what it will do.
          accessibilityLabel={secure ? "Show password" : "Hide password"}
          style={styles.eye}
        >
          <Ionicons name={secure ? "eye-off-outline" : "eye-outline"} size={18} color={WHITE_52} />
        </Pressable>
      )}
    </View>
  );
}

/** Inline, on-brand error banner. Renders nothing when there's no message. */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={15} color={ERROR_TINT} style={styles.errorIcon} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** The cross-screen link at the sheet's foot: "New here? Create an account". */
export function AuthFooter({ prompt, actionSlot }: { prompt: string; actionSlot: React.ReactNode }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{prompt} </Text>
      {actionSlot}
    </View>
  );
}

/**
 * The legal band welded to the sheet's foot.
 *
 * Full-bleed and faintly gold so it reads as the sheet's own footer rather than
 * as a caption that happened to land last. It carries the bottom safe-area
 * inset itself, which is why nothing else on this surface pays for it.
 *
 * The full consent gate still comes after sign-in (app/legal/consent.tsx), but
 * the documents must also be reachable at the moment an account is created: the
 * reviewer looks for it here, and nobody should have to make an account to read
 * what they are agreeing to. Both are readable while signed out (see
 * AuthWrapper).
 */
export function AuthLegalStrip({ verb = "continuing" }: { verb?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.legalStrip, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Text style={styles.legalText}>
        By {verb} you agree to our{" "}
        <Text style={styles.legalLink} onPress={() => router.push("/legal/terms" as never)}>
          Terms of Use
        </Text>{" "}
        and{" "}
        <Text style={styles.legalLink} onPress={() => router.push("/legal/privacy" as never)}>
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  link: { color: GOLD, fontSize: 13.5, fontWeight: "700" },
});

/* ────────────────────────────────── Styles ──────────────────────────────── */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  canvas: { flex: 1, backgroundColor: CANVAS },
  pressedDim: { opacity: 0.6 },

  /* Hero */
  hero: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  heroStage: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  halo: { alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1 },
  // Fills compound as they nest: 25% → 1/3 → 1/2 is 25% → 50% → 75% dark overall.
  haloOuter: {
    width: MARK_DISC + HALO_STEP * 3,
    height: MARK_DISC + HALO_STEP * 3,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderColor: "rgba(196,136,60,0.24)",
  },
  haloMid: {
    width: MARK_DISC + HALO_STEP * 2,
    height: MARK_DISC + HALO_STEP * 2,
    backgroundColor: "rgba(0,0,0,0.333)",
    borderColor: "rgba(222,168,70,0.30)",
  },
  haloInner: {
    width: MARK_DISC + HALO_STEP,
    height: MARK_DISC + HALO_STEP,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderColor: "rgba(246,200,84,0.38)",
  },
  markDisc: {
    width: MARK_DISC,
    height: MARK_DISC,
    borderRadius: MARK_DISC / 2,
    overflow: "hidden",
    backgroundColor: ICON_GROUND,
  },
  // Oversized and offset so the art's ring centre lands on the disc's centre;
  // the square's edges all fall outside the disc and are clipped away.
  markArt: {
    position: "absolute",
    width: ICON_ART.size * markScale,
    height: ICON_ART.size * markScale,
    left: MARK_DISC / 2 - ICON_ART.cx * markScale,
    top: MARK_DISC / 2 - ICON_ART.cy * markScale,
  },
  markEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: MARK_DISC / 2,
    borderWidth: 1,
    borderColor: "rgba(246,207,84,0.46)",
  },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0 },

  /* Chrome */
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerSlot: { width: 36, height: 36, justifyContent: "center" },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: WHITE,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  /* Layout */
  scroll: { flexGrow: 1, justifyContent: "flex-end" },
  heroSpacer: { flex: 1, minHeight: 24 },

  /* Sheet */
  sheet: {
    backgroundColor: SHEET,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderTopWidth: 1,
    borderColor: HAIRLINE,
    paddingTop: 10,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    marginBottom: 18,
  },
  sheetHead: { paddingHorizontal: 22 },
  sheetTitle: { color: WHITE, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  sheetSubtitle: { color: WHITE_52, fontSize: 13, marginTop: 5, lineHeight: 18 },

  /* Trust note */
  trust: { alignItems: "center", paddingHorizontal: 22, marginTop: 20 },
  trustMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246,207,84,0.10)",
    borderWidth: 1,
    borderColor: "rgba(246,207,84,0.22)",
    marginBottom: 10,
  },
  trustTitle: { color: WHITE, fontSize: 14.5, fontWeight: "700" },
  trustBody: { color: WHITE_52, fontSize: 12.5, marginTop: 3, textAlign: "center", lineHeight: 17 },

  /* Provider rows */
  providerStack: { paddingHorizontal: 22, marginTop: 20, gap: 10 },
  row: {
    height: ROW_HEIGHT,
    borderRadius: ROW_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rowDark: { backgroundColor: ROW_DARK, borderWidth: 1, borderColor: HAIRLINE },
  rowLight: { backgroundColor: WHITE },
  rowMark: { marginRight: 10 },
  rowLabel: { color: WHITE, fontSize: 15, fontWeight: "600" },
  rowLabelLight: { color: "#000000", fontWeight: "700" },
  pressedRow: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  rowDisabled: { opacity: 0.55 },

  goldRow: {
    height: ROW_HEIGHT,
    borderRadius: ROW_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  goldLabel: { color: INK, fontSize: 15.5, fontWeight: "800", letterSpacing: 0.2 },

  /* Email disclosure + form */
  emailToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  emailToggleText: { color: WHITE_52, fontSize: 13.5, fontWeight: "600" },
  formBlock: { paddingHorizontal: 22, paddingBottom: 4 },

  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: ROW_RADIUS,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: ROW_HEIGHT - 2,
    color: WHITE,
    fontSize: 15,
    // Android mis-centres short text in a fixed-height input without this.
    paddingVertical: 0,
  },
  eye: { padding: 4 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,120,120,0.10)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorIcon: { marginRight: 8 },
  errorText: { flex: 1, color: ERROR_TINT, fontSize: 12.5, fontWeight: "600" },

  /* Feet */
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 16,
  },
  footerText: { color: WHITE_52, fontSize: 13.5 },

  legalStrip: {
    backgroundColor: "rgba(246,207,84,0.13)",
    borderTopWidth: 1,
    borderTopColor: "rgba(246,207,84,0.13)",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  legalText: { color: WHITE_52, fontSize: 11.5, lineHeight: 16, textAlign: "center" },
  legalLink: { color: "rgba(246,207,84,0.95)", textDecorationLine: "underline", fontWeight: "600" },
});
