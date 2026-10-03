/**
 * The starting cuisine read from the device's time-zone — a guess the user can
 * change on the food step, so it only has to be a sensible one.
 */
import { describe, expect, it } from "vitest";
import { detectRegion } from "../../utils/region";

describe("detectRegion", () => {
  it("starts East, South-East and South Asian zones on the Asian kitchen", () => {
    for (const tz of ["Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Asia/Manila", "Asia/Ho_Chi_Minh", "Asia/Karachi"]) {
      expect(detectRegion(tz).cuisine, tz).toBe("asian");
    }
    expect(detectRegion("Asia/Ho_Chi_Minh").region).toBe("Ho Chi Minh");
  });

  it("leaves the rest of Asia's zones on a bit of everything", () => {
    for (const tz of ["Asia/Dubai", "Asia/Riyadh", "Asia/Tehran", "Asia/Tashkent", "Asia/Yekaterinburg"]) {
      expect(detectRegion(tz).cuisine, tz).toBe("mixed");
    }
  });

  it("keeps every other continent where it was", () => {
    expect(detectRegion("Africa/Lagos").cuisine).toBe("african");
    expect(detectRegion("Europe/Rome").cuisine).toBe("mediterranean");
    expect(detectRegion("Europe/London").cuisine).toBe("western");
    expect(detectRegion("America/New_York").cuisine).toBe("western");
    expect(detectRegion("Australia/Sydney").cuisine).toBe("mixed");
  });
});
