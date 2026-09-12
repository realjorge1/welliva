/**
 * WHICH SOCIAL BUTTONS EXIST — asked of the project, never guessed.
 *
 * The property under test is the conservative one: a provider is drawn only
 * when the server says it is on. Every other outcome — a network failure, a
 * 500, a payload that isn't the shape we expect — must fall back to the known
 * set, because the alternative is a button that greets the user with
 * "provider is not enabled".
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PROVIDERS,
  fetchSocialProviders,
  providersFromSettings,
  resetSocialProvidersCache,
} from "../auth/socialProviders";

/** The real payload shape, trimmed to what this app reads. */
const settings = (external: Record<string, boolean>) => ({
  external: { email: true, ...external },
  disable_signup: false,
});

const okResponse = (body: unknown) => ({ ok: true, json: async () => body });

describe("providersFromSettings", () => {
  it("reads the three providers the app offers", () => {
    expect(
      providersFromSettings(settings({ google: true, facebook: true, apple: false })),
    ).toEqual({ google: true, facebook: true, apple: false });
  });

  it("treats a missing provider as off, not as unknown", () => {
    expect(providersFromSettings(settings({ google: true }))).toEqual({
      google: true,
      facebook: false,
      apple: false,
    });
  });

  it("falls back rather than trusting a payload it does not recognise", () => {
    expect(providersFromSettings(null)).toEqual(DEFAULT_PROVIDERS);
    expect(providersFromSettings({})).toEqual(DEFAULT_PROVIDERS);
    expect(providersFromSettings("nonsense")).toEqual(DEFAULT_PROVIDERS);
  });
});

describe("fetchSocialProviders", () => {
  // Vitest reuses a worker process across test FILES, so `process.env` edits
  // outlive this suite unless they are put back. Leaving a fake Supabase URL
  // behind is the kind of cross-file contamination that shows up later as one
  // unrelated test failing depending on the order files happen to run in.
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetSocialProvidersCache();
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetSocialProvidersCache();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("asks once per launch, however many screens want the answer", async () => {
    const fetchMock = vi.fn(async () =>
      okResponse(settings({ google: true, facebook: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Called in the same tick, as two mounting screens would.
    const [first, second] = await Promise.all([
      fetchSocialProviders(),
      fetchSocialProviders(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(await fetchSocialProviders()).toEqual(first);
  });

  it("shows the known set when the project cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Network request failed");
    });
    // Offline at the sign-in screen must not be the reason a new button appears.
    expect(await fetchSocialProviders()).toEqual(DEFAULT_PROVIDERS);
  });

  it("shows the known set on a non-OK response", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await fetchSocialProviders()).toEqual(DEFAULT_PROVIDERS);
  });

  it("hides a provider the project has switched off", async () => {
    vi.stubGlobal("fetch", async () => okResponse(settings({ google: true, facebook: false })));
    expect(await fetchSocialProviders()).toEqual({
      google: true,
      facebook: false,
      apple: false,
    });
  });
});
