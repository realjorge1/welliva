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
import { friendlyAuthError, isEmailNotConfirmed } from "@/components/auth/authErrors";
import { OFFERED_SIGN_IN } from "@/components/auth/signInMethods";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

/**
 * SIGN IN — hero + sheet.
 *
 * ── THE SHAPE OF THE DECISION ───────────────────────────────────────────────
 * The sheet asks one question — how do you want in — and puts the fast answers
 * first: the provider rows. Email is a disclosure below them, closed on arrival.
 *
 * That ordering is the whole redesign, and it is not cosmetic. The old screen
 * opened with two text fields, which is the slowest way in and the one most
 * likely to end at a forgotten password. Social sign-in is one tap and cannot
 * fail on a typo. But email is still here, in full, because every account this
 * app has issued so far is an email account — demoting the form is a design
 * decision, deleting it would be a lockout.
 *
 * ── WHAT IT KEEPS FROM THE OLD SCREEN ───────────────────────────────────────
 * All of the behaviour. `redirectError` still wins until the user does
 * something new; typing still clears it; an unconfirmed address still routes to
 * /verify-email rather than dead-ending on an error line, because that failure
 * has somewhere better to go than a sentence.
 *
 * ── WHILE EMAIL IS NOT OFFERED ──────────────────────────────────────────────
 * `OFFERED_SIGN_IN.email` (components/auth/signInMethods.ts) hides the
 * disclosure and keeps the form shut; everything else stays, so flipping the
 * switch back restores the screen exactly. Errors still have a home — the
 * standalone banner below the rows.
 */

export default function SignInScreen() {
  const {
    signInWithEmail,
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
  const [emailLoading, setEmailLoading] = useState(false);
  const [pendingSocial, setPendingSocial] = useState<PendingSocial>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || pendingSocial !== null || isLoading;
  // Nothing can open a form we are not offering — including the social
  // failure path below, which would otherwise pop it open to show its error.
  const emailOffered = OFFERED_SIGN_IN.email;
  const formOpen = emailOffered && showEmailForm;

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

  // The growing/shrinking is animated by the sheet itself (AuthKit's `layout`
  // transition plus the form block's fade), so this is just the state flip.
  const toggleEmailForm = () => setShowEmailForm((open) => !open);

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
      if (provider === "google") await signInWithGoogle();
      else if (provider === "apple") await signInWithApple();
      else await signInWithFacebook();
    } catch (err) {
      console.error(`${provider} sign in error:`, err);
      // A social failure has no form to sit under, so open the disclosure —
      // otherwise the banner would render into a collapsed block and the tap
      // would look like it did nothing at all.
      setShowEmailForm(true);
      setError(friendlyAuthError(err));
    } finally {
      setPendingSocial(null);
    }
  };

  return (
    <AuthScreen title="welliva">
      <AuthSheetTitle
        title="Welcome back!"
        subtitle="Please choose your preferred sign in method"
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
          label={formOpen ? "Hide email sign in" : "Continue with email"}
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
            placeholder="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearErrors();
            }}
            secure={!showPassword}
            showSecureToggle
            onToggleSecure={() => setShowPassword((s) => !s)}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onEmailSignIn}
            editable={!loading}
          />

          <AuthError message={shownError} />

          <AuthPrimaryButton
            label="Sign in"
            onPress={onEmailSignIn}
            loading={emailLoading}
            disabled={loading}
          />
        </AuthFormBlock>
      )}

      {/* The banner has nowhere to live while the form is closed, so it comes
          out to the sheet's own gutter instead of vanishing. */}
      {!formOpen && shownError && (
        <AuthFormBlock>
          <AuthError message={shownError} />
        </AuthFormBlock>
      )}

      <AuthFooter
        prompt="New here?"
        actionSlot={
          <Link href="/sign-up" asChild>
            <Pressable hitSlop={8}>
              <Text style={authStyles.link}>Create an account</Text>
            </Pressable>
          </Link>
        }
      />

      <AuthLegalStrip verb="signing in" />
    </AuthScreen>
  );
}
