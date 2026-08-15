import {
  AuthBackground,
  AuthBrand,
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooter,
  AuthLegalNote,
  AuthPrimaryButton,
  SOCIAL_ENABLED,
  SocialButton,
  authStyles,
} from "@/components/AuthKit";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

/** Map a Supabase signUp error to a short, user-facing sentence. */
function friendlySignUpError(err: any): string {
  const msg = String(err?.message ?? "").toLowerCase();
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (msg.includes("password")) {
    return "Please choose a stronger password (at least 6 characters).";
  }
  if (msg.includes("valid email") || msg.includes("invalid email") || msg.includes("unable to validate")) {
    return "Please enter a valid email address.";
  }
  return err?.message || "Could not create account. Please try again.";
}

export default function SignUpScreen() {
  const { signUpWithEmail, signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || googleLoading || isLoading;

  const onEmailSignUp = async () => {
    setError(null);
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setEmailLoading(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
      if (needsEmailConfirmation) {
        // Confirmations ON: account created but no session yet — send them to the
        // verify-email screen to tap the link. (Confirmations OFF: a live session
        // came back, so we do nothing and AuthWrapper routes into onboarding.)
        router.replace({
          // `as any`: typed-routes regenerates this path on the next `expo start`
          // (same cast the app already uses for /onboarding etc.).
          pathname: "/verify-email" as any,
          params: { email: email.trim() },
        });
      }
    } catch (err: any) {
      console.error("Email sign up error:", err);
      setError(friendlySignUpError(err));
    } finally {
      setEmailLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthBackground>
      <AuthBrand title="Create account" subtitle="Join thousands improving their health" />

      <AuthField
        icon="mail-outline"
        placeholder="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      <AuthField
        icon="lock-closed-outline"
        placeholder="Password (min 6 characters)"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError(null);
        }}
        secure={!showPassword}
        showSecureToggle
        onToggleSecure={() => setShowPassword((s) => !s)}
        editable={!loading}
      />
      <AuthField
        icon="lock-closed-outline"
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={(t) => {
          setConfirmPassword(t);
          if (error) setError(null);
        }}
        secure={!showConfirmPassword}
        showSecureToggle
        onToggleSecure={() => setShowConfirmPassword((s) => !s)}
        editable={!loading}
      />

      <AuthError message={error} />

      <AuthPrimaryButton label="Create Account" onPress={onEmailSignUp} loading={emailLoading} disabled={loading} />

      <AuthLegalNote />

      {SOCIAL_ENABLED && (
        <>
          <AuthDivider />
          <View style={[{ flexDirection: "row", justifyContent: "center" }, authStyles.rowGap]}>
            <SocialButton icon="logo-google" tint="#DB4437" loading={googleLoading} onPress={onGoogleSignIn} disabled={loading} />
          </View>
        </>
      )}

      <AuthFooter
        prompt="Already have an account?"
        actionSlot={
          <Link href="/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={authStyles.link}>Sign In</Text>
            </Pressable>
          </Link>
        }
      />
    </AuthBackground>
  );
}
