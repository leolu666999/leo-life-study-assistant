import { describe, expect, it } from "vitest";
import { buildTimetableMonthDateKeys } from "@/lib/timetable-month";
import { courseOccurrenceSequence } from "@/lib/timetable-occurrence";

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

describe("timetable occurrence sequence", () => {
  const occurrences = [
    { id: "third", courseId: "lecture-series", startAt: "2026-08-17T23:00:00.000Z", status: "scheduled" as const },
    { id: "first", courseId: "lecture-series", startAt: "2026-08-03T23:00:00.000Z", status: "completed" as const },
    { id: "cancelled", courseId: "lecture-series", startAt: "2026-08-10T23:00:00.000Z", status: "cancelled" as const },
    { id: "workshop", courseId: "workshop-series", startAt: "2026-08-11T00:00:00.000Z", status: "scheduled" as const },
    { id: "second", courseId: "lecture-series", startAt: "2026-08-10T23:00:00.000Z", status: "scheduled" as const }
  ];

  it("numbers an occurrence within its own active course series", () => {
    expect(courseOccurrenceSequence(occurrences[4], occurrences)).toEqual({ number: 2, total: 3 });
  });

  it("does not count cancelled or other activity series", () => {
    expect(courseOccurrenceSequence(occurrences[2], occurrences)).toEqual({ number: null, total: 3 });
    expect(courseOccurrenceSequence(occurrences[3], occurrences)).toEqual({ number: 1, total: 1 });
  });
});
