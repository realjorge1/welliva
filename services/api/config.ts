/**
 * Welliva backend API — client config.
 *
 * The backend (see /backend-welliva) holds the Anthropic key and runs all AI. The app
 * only needs its URL. Set EXPO_PUBLIC_API_URL to enable the AI features; when it
 * is unset — or set to something a shipped app can't legally reach — the app
 * falls back to the on-device deterministic engines.
 *
 * FAIL-CLOSED IN RELEASE. `EXPO_PUBLIC_*` is inlined at build time, so a stray
 * LAN IP / cleartext http:// URL left in a build config would ship to the store.
 * iOS ATS and Android cleartext policy block those anyway, so rather than hang on
 * a dead endpoint we treat a non-HTTPS or private-host URL as "not configured"
 * and quietly use the on-device engines. In __DEV__ anything is allowed, so a
 * laptop's LAN IP (e.g. http://192.168.1.20:8787) still works while developing.
 */
const raw = process.env.EXPO_PUBLIC_API_URL?.trim();

const isHttps = /^https:\/\//i.test(raw ?? "");
const isPrivateHost =
  /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
    raw ?? "",
  );

/** True when a USABLE backend URL is configured — gates AI-first paths. */
export const isApiConfigured =
  Boolean(raw) && (__DEV__ || (isHttps && !isPrivateHost));

/** Base URL with any trailing slashes stripped. */
export const API_BASE_URL = (raw || "http://localhost:8787").replace(/\/+$/, "");
