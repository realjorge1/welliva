import {
  AuthBackground,
  AuthBrand,
  AuthError,
  AuthFooter,
  AuthPrimaryButton,
  authStyles,
} from "@/components/AuthKit";
import { friendlyAuthError, isEmailRateLimited } from "@/components/auth/authErrors";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { supabase } from "@/lib/supabase";
import { Link, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * VERIFY EMAIL — the pending state when email confirmations are ON (B2).
 *
 * After sign-up there's a user but no session yet: the account is created but the
 * link in the email must be tapped first. That tap deep-links back into the app
 * (welliva://auth-callback), where SupabaseAuthProvider exchanges the code for a
 * session and routing takes over. This screen just explains that and offers a
 * Resend. With confirmations OFF the app never lands here (sign-up gets a live
 * session and routes straight to onboarding).
 *
 * It is also where a FAILED link lands. Tapping an expired one re-opens the app
 * with an error and no session; `redirectError` carries the reason across, so
 * the screen can say "that link expired" next to the button that fixes it,
 * rather than leaving the user staring at an inbox that looks fine.
 */
export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { redirectError, clearRedirectError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onResend = async () => {
    if (!email) return;
    setError(null);
    if (redirectError) clearRedirectError();
    setSent(false);
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
      setSent(true);
    } catch (err) {
      // The likeliest failure here by far is the project's own e-mail quota,
      // not anything the user did — friendlyAuthError says as much rather than
      // showing them "email rate limit exceeded".
      setError(friendlyAuthError(err));
      if (isEmailRateLimited(err)) console.warn("Resend blocked by email quota:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <AuthBrand
        title="Check your email"
        subtitle={
          email
            ? `We sent a confirmation link to ${email}. Tap it to activate your account, then you'll be brought right back here.`
            : "We sent you a confirmation link. Tap it to activate your account."
        }
      />

      <AuthError message={error ?? redirectError} />
      {sent && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: "#8FE3A6", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            Sent! Check your inbox (and spam folder).
          </Text>
        </View>
      )}

      <AuthPrimaryButton
        label="Resend email"
        onPress={onResend}
        loading={loading}
        disabled={loading || !email}
      />

      <AuthFooter
        prompt="Wrong email or already verified?"
        actionSlot={
          <Link href="/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={authStyles.link}>Back to sign in</Text>
            </Pressable>
          </Link>
        }
      />
    </AuthBackground>
  );
}
