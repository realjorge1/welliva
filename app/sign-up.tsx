import {
  AuthEmailToggle,
  AuthError,
  AuthField,
  AuthFooter,
  AuthFormBlock,
  AuthLegalStrip,
  AuthPrimaryButton,
  AuthScreen,
  AuthSheetTitle,
  AuthTrustNote,
  SocialSignInRow,
  authStyles,
  type PendingSocial,
} from "@/components/AuthKit";
import { friendlyAuthError } from "@/components/auth/authErrors";
import { OFFERED_SIGN_IN } from "@/components/auth/signInMethods";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

/**
 * SIGN UP — the same sheet as sign-in, asking the other question.
 *
 * Deliberately identical in structure: a person who bounces between these two
 * screens (and they do, because they cannot remember which one they need)
 * should feel one surface changing its wording, not two screens changing
 * places. Only the copy, the verb in the legal strip, and the three-field form
 * differ.
 *
 * The social rows are the SAME rows as sign-in, which is correct rather than
 * lazy: with OAuth there is no such thing as signing up separately — the first
 * "Continue with Google" creates the account, the second signs in, and the
 * provider decides which. Presenting them under two different labels would be
 * inventing a distinction the protocol does not have.
 */
export default function SignUpScreen() {
  const {
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || pendingSocial !== null || isLoading;
  // Same switch as sign-in: while email is not offered the form cannot open,
  // and a social failure's error falls through to the standalone banner.
  const emailOffered = OFFERED_SIGN_IN.email;
  const formOpen = emailOffered && showEmailForm;
  const shownError = error ?? redirectError;

  const clearErrors = () => {
    if (error) setError(null);
    if (redirectError) clearRedirectError();
  };

  // Animated by the sheet itself (AuthKit) — this is just the state flip.
  const toggleEmailForm = () => setShowEmailForm((open) => !open);

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
      if (provider === "google") await signInWithGoogle();
      else if (provider === "apple") await signInWithApple();
      else await signInWithFacebook();
    } catch (err) {
      console.error(`${provider} sign in error:`, err);
      // Open the form so the banner below has somewhere to render — otherwise
      // the failed tap looks like nothing happened at all.
      setShowEmailForm(true);
      setError(friendlyAuthError(err));
    } finally {
      setPendingSocial(null);
    }
  };

  return (
    <AuthScreen title="welliva">
      <AuthSheetTitle
        title="Create your account"
        subtitle="Pick how you'd like to sign up — it takes a moment"
      />

      <AuthTrustNote
        title="Private by default"
        body="Your health data is yours. We never sell it or share it with advertisers."
      />

      <SocialSignInRow
        onGoogle={onSocialSignIn("google")}
        onApple={onSocialSignIn("apple")}
        onFacebook={onSocialSignIn("facebook")}
        pending={pendingSocial}
        disabled={loading}
      />

      {emailOffered && (
        <AuthEmailToggle
          open={formOpen}
          onPress={toggleEmailForm}
          label={formOpen ? "Hide email sign up" : "Sign up with email"}
        />
      )}

      {formOpen && (
        <AuthFormBlock>
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
            autoComplete="email"
            textContentType="emailAddress"
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
            autoComplete="new-password"
            textContentType="newPassword"
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
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onEmailSignUp}
            editable={!loading}
          />

          <AuthError message={shownError} />

          <AuthPrimaryButton
            label="Create account"
            onPress={onEmailSignUp}
            loading={emailLoading}
            disabled={loading}
          />
        </AuthFormBlock>
      )}

      {!formOpen && shownError && (
        <AuthFormBlock>
          <AuthError message={shownError} />
        </AuthFormBlock>
      )}

      <AuthFooter
        prompt="Already have an account?"
        actionSlot={
          <Link href="/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={authStyles.link}>Sign in</Text>
            </Pressable>
          </Link>
        }
      />

      <AuthLegalStrip verb="creating an account" />
    </AuthScreen>
  );
}
