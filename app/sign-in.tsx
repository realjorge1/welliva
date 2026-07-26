import {
  AuthBackground,
  AuthBrand,
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooter,
  AuthPrimaryButton,
  SOCIAL_ENABLED,
  SocialButton,
  authStyles,
} from "@/components/AuthKit";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Link } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = emailLoading || googleLoading || isLoading;

  const onEmailSignIn = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setEmailLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // On success onAuthStateChange fires SIGNED_IN and AuthWrapper routes onward.
    } catch (err: any) {
      console.error("Email sign in error:", err);
      setError(err?.message || "Invalid email or password");
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
      <AuthBrand title="Welcome back" subtitle="Sign in to continue your journey" />

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
        placeholder="Password"
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

      <AuthError message={error} />

      <AuthPrimaryButton label="Sign In" onPress={onEmailSignIn} loading={emailLoading} disabled={loading} />

      {SOCIAL_ENABLED && (
        <>
          <AuthDivider />
          <View style={[{ flexDirection: "row", justifyContent: "center" }, authStyles.rowGap]}>
            <SocialButton icon="logo-google" tint="#DB4437" loading={googleLoading} onPress={onGoogleSignIn} disabled={loading} />
          </View>
        </>
      )}

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
