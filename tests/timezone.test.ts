import { describe, expect, it } from "vitest";
import { instantToWallTime, zonedWallTimeToUtc } from "@/lib/timezone";

describe("Australia/Sydney wall-time mapping", () => {
  it("maps winter wall time with the +10 standard-time offset", () => {
    expect(zonedWallTimeToUtc("2026-07-12", "19:00:00")).toBe("2026-07-12T09:00:00.000Z");
    expect(instantToWallTime("2026-07-12T09:00:00.000Z")).toBe("2026-07-12T19:00:00");
  });

  it("maps summer wall time with the +11 daylight-saving offset", () => {
    expect(zonedWallTimeToUtc("2026-12-12", "19:00:00")).toBe("2026-12-12T08:00:00.000Z");
    expect(instantToWallTime("2026-12-12T08:00:00.000Z")).toBe("2026-12-12T19:00:00");
  });
});
