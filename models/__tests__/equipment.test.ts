/**
 * The equipment rule every picker shares (onboarding, Settings, the training
 * nudge): Bodyweight combines with gear, three choices at most, never empty.
 */
import { describe, expect, it } from "vitest";
import { EQUIPMENT_LABEL, MAX_EQUIPMENT, equipmentFull, equipmentSummary, toggleEquipment } from "../equipment";

describe("toggleEquipment", () => {
  it("keeps Bodyweight when gear is added — it is not exclusive any more", () => {
    // The old rule cleared Bodyweight the moment dumbbells were picked, which
    // read as "dumbbells OR bodyweight". Both is a real answer.
    expect(toggleEquipment(["none"], "dumbbells")).toEqual({ next: ["none", "dumbbells"], capped: false });
  });

  it("does not clear the gear when Bodyweight is picked", () => {
    expect(toggleEquipment(["dumbbells"], "none")).toEqual({ next: ["dumbbells", "none"], capped: false });
  });

  it("refuses a fourth choice instead of dropping an earlier one", () => {
    const full = ["none", "dumbbells", "kettlebell"] as const;
    expect(MAX_EQUIPMENT).toBe(3);
    expect(toggleEquipment(full, "bench")).toEqual({ next: [...full], capped: true });
    // Un-ticking still works when full, which is how a swap is made.
    expect(toggleEquipment(full, "dumbbells")).toEqual({ next: ["none", "kettlebell"], capped: false });
  });

  it("never leaves the list empty", () => {
    expect(toggleEquipment(["dumbbells"], "dumbbells").next).toEqual(["none"]);
    expect(toggleEquipment(["none"], "none").next).toEqual(["none"]);
    expect(toggleEquipment(undefined, "bench").next).toEqual(["none", "bench"]);
    expect(toggleEquipment([], "bench").next).toEqual(["none", "bench"]);
  });

  it("leaves a list saved before the cap alone until it is edited", () => {
    // Older profiles may hold more than three; nothing trims them silently,
    // and a tap that would add a fifth is refused like any other over-cap tap.
    const legacy = ["dumbbells", "kettlebell", "bench", "pull_up_bar"] as const;
    expect(equipmentFull(legacy)).toBe(true);
    expect(toggleEquipment(legacy, "resistance_bands").capped).toBe(true);
    expect(toggleEquipment(legacy, "bench").next).toEqual(["dumbbells", "kettlebell", "pull_up_bar"]);
  });
});

describe("equipmentSummary", () => {
  it("reads the choices back in the order they were picked, with human labels", () => {
    expect(equipmentSummary(["none", "dumbbells", "resistance_bands"])).toBe("Bodyweight, Dumbbells, Bands");
    expect(equipmentSummary(["pull_up_bar"], " · ")).toBe("Pull-up bar");
  });

  it("treats a missing or empty list as bodyweight, never as raw 'none'", () => {
    expect(equipmentSummary(undefined)).toBe("Bodyweight");
    expect(equipmentSummary([])).toBe("Bodyweight");
    expect(equipmentSummary(["none"])).toBe(EQUIPMENT_LABEL.none);
  });
});
