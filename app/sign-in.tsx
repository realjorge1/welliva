import {
  AuthBackground,
  AuthBrand,
  AuthError,
  AuthField,
  AuthFooter,
  AuthPrimaryButton,
  SocialSignInRow,
  authStyles,
  type PendingSocial,
} from "@/components/AuthKit";
import { friendlyAuthError, isEmailNotConfirmed } from "@/components/auth/authErrors";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

export default function SignInScreen() {
  const {
    signInWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    isLoading,
    redirectError,
    clearRedirectError,
  } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [pendingSocial, setPendingSocial] = useState<PendingSocial>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || pendingSocial !== null || isLoading;

  /**
   * What to show. A redirect error — an expired confirmation link, a refused
   * OAuth consent — is about the attempt that just landed them here, so it wins
   * until they do something new; anything they type clears it (below).
   */
  const shownError = error ?? redirectError;

  /** Any fresh input retires whatever the last attempt had to say. */
  const clearErrors = () => {
    if (error) setError(null);
    if (redirectError) clearRedirectError();
  };

  const onEmailSignIn = async () => {
    clearErrors();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setEmailLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // On success onAuthStateChange fires SIGNED_IN and AuthWrapper routes onward.
    } catch (err) {
      console.error("Email sign in error:", err);
      // An unconfirmed address is the one failure with somewhere better to go
      // than an error line: the account and the password are both fine, so send
      // them where a new link can be requested rather than leaving them to
      // guess that "confirm your email" means "go find an old email".
      if (isEmailNotConfirmed(err)) {
        router.push({
          pathname: "/verify-email" as any,
          params: { email: email.trim() },
        });
        return;
      }
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
      <AuthBrand title="Welcome back" subtitle="Sign in to continue your journey" />

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
        placeholder="Password"
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

      <AuthError message={shownError} />

      <AuthPrimaryButton label="Sign In" onPress={onEmailSignIn} loading={emailLoading} disabled={loading} />

      <SocialSignInRow
        onGoogle={onSocialSignIn("google")}
        onFacebook={onSocialSignIn("facebook")}
        pending={pendingSocial}
        disabled={loading}
      />

      <AuthFooter
        prompt="Don't have an account?"
        actionSlot={
          <Link href="/sign-up" asChild>
            <Pressable hitSlop={8}>
              <Text style={authStyles.link}>Sign Up</Text>
            </Pressable>
          </Link>
        }
      />
    </AuthBackground>
  );
}
