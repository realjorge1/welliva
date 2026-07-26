import { describe, expect, it } from "vitest";

import { HealthModuleRegistry } from "../modules/registry";
import { registerBuiltInModules, moduleRegistry } from "../modules";

describe("HealthModuleRegistry (pure)", () => {
  it("aggregates event types, consent and senses across modules", () => {
    const r = new HealthModuleRegistry();
    r.register({
      id: "a",
      title: "A",
      description: "",
      eventTypes: ["x.one"],
      consent: ["calendar"],
      signalSources: [
        { id: "cal", label: "Cal", consent: "calendar", getStatus: async () => ({ permission: "unavailable", ready: false }) },
      ],
    }).register({
      id: "b",
      title: "B",
      description: "",
      eventTypes: ["y.two"],
      consent: ["calendar", "wearable"],
      producesNotifications: true,
    });

    expect(r.all()).toHaveLength(2);
    expect(r.eventTypes().sort()).toEqual(["x.one", "y.two"]);
    expect(r.consentCategories().sort()).toEqual(["calendar", "wearable"]);
    expect(r.signalSources()).toHaveLength(1);
    expect(r.notificationProducers().map((m) => m.id)).toEqual(["b"]);
  });

  it("register is idempotent by id (replaces, never duplicates)", () => {
    const r = new HealthModuleRegistry();
    r.register({ id: "a", title: "A", description: "first" });
    r.register({ id: "a", title: "A", description: "second" });
    expect(r.all()).toHaveLength(1);
    expect(r.get("a")?.description).toBe("second");
  });
});

describe("built-in companion modules", () => {
  it("registers the shipped companion capabilities on import", () => {
    registerBuiltInModules(); // idempotent — barrel already ran it
    const ids = moduleRegistry.all().map((m) => m.id).sort();
    expect(ids).toEqual(["lifecontext", "multimodal", "notifications", "signals", "story"]);
  });

  it("exposes the companion's consent categories + a sense per integration", () => {
    const cats = moduleRegistry.consentCategories();
    for (const c of ["calendar", "location_weather", "wearable", "proactive_notifications", "photo", "voice"]) {
      expect(cats).toContain(c);
    }
    // calendar, weather, wearable, notifications, photo, voice
    expect(moduleRegistry.signalSources().length).toBe(6);
  });
});
