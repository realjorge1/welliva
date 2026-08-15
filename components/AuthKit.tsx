/**
 * AuthKit — the shared, on-brand canvas + controls for sign-in / sign-up.
 * The warm near-black→brown gradient stays; over it drift a handful of very
 * light-yellow orbs (the dark-mode brand hue) via the shared <OrbField>, so the
 * surface feels alive but never busy. Premium and theme-agnostic (auth is a
 * fixed branded surface, independent of light/dark).
 */
import { OrbField, useOrbTouch } from "@/components/OrbField";
import { Radius, Spacing, brandGradientDark } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

const AUTH_GRADIENT = ["#000000", "#180B04", "#3A1E08"] as const;
/** The dark-mode brand yellow — orbs, links and the primary button. */
const BUBBLE_YELLOW = brandGradientDark[0]; // #F6CF54
/** Near-black with a warm cast — legible ink on top of the brand yellow. */
const INK = "#1C1206";
/** Glass fields carry a faint yellow cast so they belong to the same family. */
const FIELD_BG = "rgba(246,207,84,0.07)";
const FIELD_BORDER = "rgba(246,207,84,0.20)";
const WHITE_70 = "rgba(255,255,255,0.7)";
const WHITE_55 = "rgba(255,255,255,0.55)";
/** Soft warm red for inline validation / auth errors, legible on the dark canvas. */
const ERROR_TINT = "#FF9E9E";

/**
 * Master switch for the Google social button. Enabled now that Google OAuth is
 * configured (Supabase provider + Google Cloud client — Phase C2). The button
 * runs the real signInWithGoogle flow; the deep-link handler in
 * SupabaseAuthProvider completes it via welliva://auth-callback.
 */
export const SOCIAL_ENABLED: boolean = true;

export function AuthBackground({ children }: { children: React.ReactNode }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;
  // Bubble-phase touch observers — any press or swipe landing on an orb
  // bounces it off elastically, without interfering with the form itself.
  const { touch, touchHandlers } = useOrbTouch();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  return (
    <LinearGradient
      colors={AUTH_GRADIENT}
      style={styles.flex}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      {...touchHandlers}
    >
      {/* Decorative depth — soft yellow orbs drifting behind the form. */}
      <OrbField color={BUBBLE_YELLOW} touch={touch} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

export function AuthBrand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.brand}>
      <LinearGradient
        colors={brandGradientDark}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.logo}
      >
        <Ionicons name="leaf" size={26} color={INK} />
      </LinearGradient>
      <Text style={styles.wordmark}>welliva</Text>
      <Text style={styles.tagline}>Your AI-powered wellness companion</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

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
      <Ionicons name={icon} size={20} color={WHITE_70} style={styles.fieldIcon} />
      <TextInput
        style={styles.input}
        placeholderTextColor={WHITE_55}
        secureTextEntry={secure}
        {...rest}
      />
      {showSecureToggle && (
        <Pressable onPress={onToggleSecure} hitSlop={8} style={styles.eye}>
          <Ionicons name={secure ? "eye-off-outline" : "eye-outline"} size={20} color={WHITE_70} />
        </Pressable>
      )}
    </View>
  );
}

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
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, tension: 300, friction: 18 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          if (disabled || loading) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onPress();
        }}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={disabled || loading}
        style={(disabled || loading) && { opacity: 0.7 }}
      >
        <LinearGradient
          colors={brandGradientDark}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryBtn}
        >
          {loading ? (
            <ActivityIndicator color={INK} />
          ) : (
            <Text style={styles.primaryBtnText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Inline, on-brand error banner. Renders nothing when there's no message. */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color={ERROR_TINT} style={styles.errorIcon} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthDivider({ label = "or continue with" }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function SocialButton({
  icon,
  tint,
  loading,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  loading?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.social, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
    >
      {loading ? <ActivityIndicator color={tint} /> : <Ionicons name={icon} size={24} color={tint} />}
    </Pressable>
  );
}

export function AuthFooter({
  prompt,
  actionSlot,
}: {
  prompt: string;
  actionSlot: React.ReactNode;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{prompt} </Text>
      {actionSlot}
    </View>
  );
}

/**
 * The legal line under the sign-up form. The full consent gate comes after
 * sign-in (app/legal/consent.tsx), but the terms must also be reachable at the
 * moment an account is created — the reviewer looks for it there, and a user
 * shouldn't have to make an account to read what they're agreeing to. Both
 * documents are readable while signed out (see AuthWrapper).
 */
export function AuthLegalNote() {
  const router = useRouter();
  return (
    <Text style={styles.legalNote}>
      By creating an account you agree to our{" "}
      <Text
        style={styles.legalLink}
        onPress={() => router.push("/legal/terms" as never)}
      >
        Terms of Use
      </Text>{" "}
      and{" "}
      <Text
        style={styles.legalLink}
        onPress={() => router.push("/legal/privacy" as never)}
      >
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

export const authStyles = StyleSheet.create({
  link: { color: BUBBLE_YELLOW, fontSize: 14, fontWeight: "700" },
  rowGap: { gap: Spacing.md },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.giant,
  },
  brand: { alignItems: "center", marginBottom: Spacing.xxl },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: WHITE_70,
    marginTop: 4,
    marginBottom: Spacing.xxl,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: WHITE_70, marginTop: 6, textAlign: "center" },

  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FIELD_BG,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  fieldIcon: { marginRight: Spacing.md },
  input: { flex: 1, height: 56, color: "#FFFFFF", fontSize: 16 },
  eye: { padding: Spacing.sm },

  primaryBtn: {
    borderRadius: Radius.pill,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: INK, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,120,120,0.10)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.30)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorIcon: { marginRight: Spacing.sm },
  errorText: { flex: 1, color: ERROR_TINT, fontSize: 13, fontWeight: "600" },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.xxl },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  dividerText: { color: WHITE_70, paddingHorizontal: Spacing.lg, fontSize: 13 },

  social: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: Spacing.xxl },
  footerText: { color: WHITE_70, fontSize: 14 },
  legalNote: {
    color: WHITE_55,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  legalLink: { color: BUBBLE_YELLOW, fontWeight: "700" },
});
