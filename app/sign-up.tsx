import {
  AuthBackground,
  AuthBrand,
  AuthError,
  AuthField,
  AuthFooter,
  AuthLegalNote,
  AuthPrimaryButton,
  SocialSignInRow,
  authStyles,
  type PendingSocial,
} from "@/components/AuthKit";
import { friendlyAuthError } from "@/components/auth/authErrors";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

export default function SignUpScreen() {
  const {
    signUpWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    isLoading,
    redirectError,
    clearRedirectError,
  } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [pendingSocial, setPendingSocial] = useState<PendingSocial>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || pendingSocial !== null || isLoading;
  const shownError = error ?? redirectError;

  const clearErrors = () => {
    if (error) setError(null);
    if (redirectError) clearRedirectError();
  };

  const onEmailSignUp = async () => {
    clearErrors();
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
    } catch (err) {
      console.error("Email sign up error:", err);
      // Worth knowing when this fires on the project's e-mail quota
      // (`over_email_send_rate_limit`): NO account was created, so the details
      // they just typed will also fail to sign in. friendlyAuthError says so.
      setError(friendlyAuthError(err));
    } finally {
      setEmailLoading(false);
    }
  };

  const onSocialSignIn = (provider: Exclude<PendingSocial, null>) => async () => {
    clearErrors();
    setPendingSocial(provider);
    try {
      await (provider === "google" ? signInWithGoogle() : signInWithFacebook());
    } catch (err) {
      console.error(`${provider} sign in error:`, err);
      setError(friendlyAuthError(err));
    } finally {
      setPendingSocial(null);
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
          clearErrors();
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
          clearErrors();
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
          clearErrors();
        }}
        secure={!showConfirmPassword}
        showSecureToggle
        onToggleSecure={() => setShowConfirmPassword((s) => !s)}
        editable={!loading}
      />

      <AuthError message={shownError} />

      <AuthPrimaryButton label="Create Account" onPress={onEmailSignUp} loading={emailLoading} disabled={loading} />

      <AuthLegalNote />

      <SocialSignInRow
        onGoogle={onSocialSignIn("google")}
        onFacebook={onSocialSignIn("facebook")}
        pending={pendingSocial}
        disabled={loading}
      />

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
