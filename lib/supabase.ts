import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { Database } from "./database.types";
import { ChunkedSecureStore } from "./secureSessionStore";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Custom storage adapter for Expo.
// Uses SecureStore for native (more secure) and AsyncStorage for web.
//
// The native path delegates to `ChunkedSecureStore` (lib/secureSessionStore.ts),
// which transparently splits large values across multiple SecureStore entries —
// load-bearing on Android, where SecureStore silently fails above ~2 KB and a
// Supabase session can exceed that. Here we only add the web branch (AsyncStorage)
// and the fail-soft try/catch: a storage error must never crash the app, it just
// means the session isn't restored and the user re-authenticates.
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== "undefined") {
        return AsyncStorage.getItem(key);
      }
      return null;
    }
    try {
      return await ChunkedSecureStore.getItem(key);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== "undefined") {
        await AsyncStorage.setItem(key, value);
      }
      return;
    }
    try {
      await ChunkedSecureStore.setItem(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== "undefined") {
        await AsyncStorage.removeItem(key);
      }
      return;
    }
    try {
      await ChunkedSecureStore.removeItem(key);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE: OAuth + email-confirmation redirects come back with a `?code=…` that
    // we exchange for a session via the deep-link handler in SupabaseAuthProvider.
    flowType: "pkce",
    // On web the redirect lands back in the page and supabase-js can read it from
    // the URL itself; on native we handle the deep link ourselves.
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Export for easy access
export type SupabaseClient = typeof supabase;
