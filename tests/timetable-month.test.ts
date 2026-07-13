import { describe, expect, it } from "vitest";
import { buildTimetableMonthDateKeys } from "@/lib/timetable-month";

describe("timetable month grid", () => {
  it("builds a stable six-week Monday-to-Sunday grid", () => {
    const days = buildTimetableMonthDateKeys("2026-08-18");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-07-27");
    expect(days[41]).toBe("2026-09-06");
    expect(days.filter((day) => day.startsWith("2026-08"))).toHaveLength(31);
  });

  it("starts directly on the first when a month begins on Monday", () => {
    const days = buildTimetableMonthDateKeys("2027-02-12");
    expect(days[0]).toBe("2027-02-01");
    expect(days[6]).toBe("2027-02-07");
  });

  it("rejects an invalid month instead of producing shifted dates", () => {
    expect(buildTimetableMonthDateKeys("2026-13-01")).toEqual([]);
  });
});