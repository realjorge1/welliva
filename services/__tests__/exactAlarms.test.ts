/**
 * Exact alarms — "will this reminder arrive on the minute?"
 *
 * Locks the two rules the reminder runner depends on:
 *   · the status maps honestly (no native module → "not-applicable", never a
 *     false "exact"), and
 *   · a change in EITHER direction reads as a change — a grant leaves reminders
 *     laid earlier inexact; a revoke makes Android cancel every exact alarm — so
 *     both must force a re-lay, and the new state is only recorded once the
 *     re-lay has been done (commit), so a failed one is retried.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  present: true,
  exact: false,
  canScheduleExactAlarms: vi.fn(),
  openExactAlarmSettings: vi.fn(),
}));

vi.mock("expo", () => ({
  requireOptionalNativeModule: () =>
    native.present
      ? {
          canScheduleExactAlarms: native.canScheduleExactAlarms,
          openExactAlarmSettings: native.openExactAlarmSettings,
        }
      : null,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EXACT_ALARM_STATE_KEY,
  commitExactAlarmStatus,
  exactAlarmStatus,
  exactAlarmStatusChanged,
  openExactAlarmSettings,
} from "../notifications/exactAlarms";

beforeEach(async () => {
  native.canScheduleExactAlarms.mockReset();
  native.canScheduleExactAlarms.mockImplementation(() => native.exact);
  native.openExactAlarmSettings.mockReset().mockReturnValue(true);
  native.exact = false;
  await AsyncStorage.removeItem(EXACT_ALARM_STATE_KEY);
});

describe("exactAlarmStatus", () => {
  it("reads the platform's answer", () => {
    native.exact = true;
    expect(exactAlarmStatus()).toBe("exact");
    native.exact = false;
    expect(exactAlarmStatus()).toBe("inexact");
  });

  it("never claims exact when the native call fails", () => {
    native.canScheduleExactAlarms.mockImplementation(() => {
      throw new Error("no activity");
    });
    expect(exactAlarmStatus()).toBe("not-applicable");
  });

  it("opens the settings page through the module", () => {
    expect(openExactAlarmSettings()).toBe(true);
    expect(native.openExactAlarmSettings).toHaveBeenCalledTimes(1);
  });
});

describe("exactAlarmStatusChanged / commitExactAlarmStatus", () => {
  it("does not treat the first-ever reading as a change", async () => {
    expect(await exactAlarmStatusChanged("inexact")).toBe(false);
  });

  it("sees a grant as a change, until it is committed", async () => {
    await commitExactAlarmStatus("inexact");
    expect(await exactAlarmStatusChanged("exact")).toBe(true);
    // Not recorded yet — a re-lay that failed part-way is retried next run.
    expect(await exactAlarmStatusChanged("exact")).toBe(true);
    await commitExactAlarmStatus("exact");
    expect(await exactAlarmStatusChanged("exact")).toBe(false);
  });

  it("sees a revoke as a change too — Android cancelled the exact alarms", async () => {
    await commitExactAlarmStatus("exact");
    expect(await exactAlarmStatusChanged("inexact")).toBe(true);
  });

  it("ignores platforms where it doesn't apply", async () => {
    await commitExactAlarmStatus("inexact");
    expect(await exactAlarmStatusChanged("not-applicable")).toBe(false);
    await commitExactAlarmStatus("not-applicable");
    expect(await AsyncStorage.getItem(EXACT_ALARM_STATE_KEY)).toBe("inexact");
  });
});
