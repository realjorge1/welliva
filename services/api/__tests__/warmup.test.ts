/**
 * Backend warm-up.
 *
 * The properties that matter are all about restraint: this runs on every
 * foreground transition, so it must dedupe aggressively and must never reject —
 * a warm-up that throws would take down whatever fired it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `react-native`'s AppState has no Node implementation; the warm-up only needs
// the subscribe/unsubscribe shape.
const listeners: ((s: string) => void)[] = [];
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_: string, cb: (s: string) => void) => {
      listeners.push(cb);
      return {
        remove: () => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        },
      };
    },
  },
}));

vi.mock("../config", () => ({
  API_BASE_URL: "https://api.test",
  isApiConfigured: true,
}));

const { warmBackend, isBackendWarm, installBackendWarmup, __resetWarmupForTests } =
  await import("../warmup");

describe("backend warm-up", () => {
  beforeEach(() => {
    __resetWarmupForTests();
    listeners.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pings /health and reports the backend warm", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(warmBackend()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/health");
    expect(isBackendWarm()).toBe(true);
  });

  it("dedupes concurrent calls into one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([warmBackend(), warmBackend(), warmBackend()]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("skips a repeat ping while still inside the warm TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await warmBackend();
    await warmBackend();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("re-pings when forced, even inside the TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await warmBackend();
    await warmBackend(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never rejects when the backend is unreachable, and stays cold", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(warmBackend()).resolves.toBe(false);
    expect(isBackendWarm()).toBe(false);
  });

  it("treats a non-2xx health response as not warm", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(warmBackend()).resolves.toBe(false);
    expect(isBackendWarm()).toBe(false);
  });

  it("warms on install and again on each foreground transition", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const teardown = installBackendWarmup();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    // Backgrounding must not ping; only a return to "active" does.
    listeners.forEach((l) => l("background"));
    expect(fetchMock).toHaveBeenCalledOnce();

    __resetWarmupForTests.call(null); // expire the TTL
    const again = installBackendWarmup();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    teardown();
    again();
  });

  it("teardown unsubscribes", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const teardown = installBackendWarmup();
    expect(listeners.length).toBe(1);
    teardown();
    expect(listeners.length).toBe(0);
  });
});
