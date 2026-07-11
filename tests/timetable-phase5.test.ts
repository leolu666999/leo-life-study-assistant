import { describe, expect, it } from "vitest";
import { fetchCalendarFeedText, isPrivateOrReservedAddress } from "@/lib/calendar-feed";
import { parseIcsToTimetablePreview } from "@/lib/ics-timetable";
import { instantToWallTime } from "@/lib/timezone";
import { TimetableService } from "@/lib/services/timetable-service";
import type { TimetableRepository } from "@/lib/repositories/timetable-repository";

const options = {
  sourceType: "ics_file" as const,
  name: "Synthetic",
  semester: "S2",
  academicYear: 2026,
  timezone: "Australia/Sydney"
};

function calendar(events: string) {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyAssist Test//EN\n${events}\nEND:VCALENDAR`;
}

function event(lines: string) {
  return `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
}

describe("Phase 5 ICS recurrence and timezone policy", () => {
  it("parses one UTC VEVENT and generates a stable source key", () => {
    const ics = calendar(event("UID:single-1\nDTSTART:20260801T000000Z\nDTEND:20260801T010000Z\nSUMMARY:TEST1000 Lecture"));
    const first = parseIcsToTimetablePreview(ics, options);
    const second = parseIcsToTimetablePreview(ics, options);
    expect(first.summary).toMatchObject({ courseCount: 1, occurrenceCount: 1, duplicateCount: 0 });
    expect(first.occurrences[0]).toMatchObject({ startAt: "2026-08-01T00:00:00.000Z", externalUid: "single-1" });
    expect(first.source.sourceKey).toMatch(/^[a-f0-9]{64}$/);
    expect(second.source.sourceKey).toBe(first.source.sourceKey);
  });

  it("keeps a 09:00 Sydney weekly recurrence at 09:00 across DST", () => {
    const ics = calendar(event([
      "UID:dst-weekly", "DTSTART;TZID=Australia/Sydney:20261001T090000", "DTEND;TZID=Australia/Sydney:20261001T100000",
      "RRULE:FREQ=WEEKLY;COUNT=2", "SUMMARY:TEST1000 Lecture"
    ].join("\n")));
    const preview = parseIcsToTimetablePreview(ics, options);
    expect(preview.occurrences).toHaveLength(2);
    expect(preview.occurrences.map((item) => instantToWallTime(item.startAt).slice(0, 16))).toEqual([
      "2026-10-01T09:00", "2026-10-08T09:00"
    ]);
    expect(preview.occurrences.map((item) => item.startAt)).toEqual([
      "2026-09-30T23:00:00.000Z", "2026-10-07T22:00:00.000Z"
    ]);
  });

  it("honors EXDATE during recurrence expansion", () => {
    const ics = calendar(event([
      "UID:exdate", "DTSTART;TZID=Australia/Sydney:20260917T090000", "DTEND;TZID=Australia/Sydney:20260917T100000",
      "RRULE:FREQ=WEEKLY;COUNT=4", "EXDATE;TZID=Australia/Sydney:20261001T090000", "SUMMARY:TEST1000 Tutorial"
    ].join("\n")));
    const starts = parseIcsToTimetablePreview(ics, options).occurrences.map((item) => instantToWallTime(item.startAt).slice(0, 10));
    expect(starts).toEqual(["2026-09-17", "2026-09-24", "2026-10-08"]);
  });

  it("expands RDATE additions with the same Sydney wall-time policy", () => {
    const ics = calendar(event([
      "UID:rdate", "DTSTART;TZID=Australia/Sydney:20260917T090000", "DTEND;TZID=Australia/Sydney:20260917T100000",
      "RDATE;TZID=Australia/Sydney:20260919T090000", "SUMMARY:TEST1000 Tutorial"
    ].join("\n")));
    const starts = parseIcsToTimetablePreview(ics, options).occurrences.map((item) => instantToWallTime(item.startAt).slice(0, 16));
    expect(starts).toEqual(["2026-09-17T09:00", "2026-09-19T09:00"]);
  });

  it("replaces a recurrence slot with one moved RECURRENCE-ID exception", () => {
    const master = event([
      "UID:moved", "DTSTART;TZID=Australia/Sydney:20260917T090000", "DTEND;TZID=Australia/Sydney:20260917T100000",
      "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:TEST1000 Workshop", "LOCATION:Original"
    ].join("\n"));
    const exception = event([
      "UID:moved", "RECURRENCE-ID;TZID=Australia/Sydney:20260924T090000",
      "DTSTART;TZID=Australia/Sydney:20260924T110000", "DTEND;TZID=Australia/Sydney:20260924T120000",
      "SUMMARY:TEST1000 Workshop", "LOCATION:Changed"
    ].join("\n"));
    const occurrences = parseIcsToTimetablePreview(calendar(`${master}\n${exception}`), options).occurrences;
    expect(occurrences).toHaveLength(3);
    const moved = occurrences.find((item) => item.isException)!;
    expect(instantToWallTime(moved.startAt).slice(0, 16)).toBe("2026-09-24T11:00");
    expect(instantToWallTime(moved.occurrenceStart!).slice(0, 16)).toBe("2026-09-24T09:00");
    expect(moved).toMatchObject({ location: "Changed", originalStartAt: moved.occurrenceStart });
  });

  it("preserves a cancelled recurrence exception without duplicating the slot", () => {
    const master = event([
      "UID:cancelled", "DTSTART;TZID=Australia/Sydney:20260917T090000", "DTEND;TZID=Australia/Sydney:20260917T100000",
      "RRULE:FREQ=WEEKLY;COUNT=2", "SUMMARY:TEST1000 Lab"
    ].join("\n"));
    const exception = event([
      "UID:cancelled", "RECURRENCE-ID;TZID=Australia/Sydney:20260924T090000", "DTSTART;TZID=Australia/Sydney:20260924T090000",
      "DTEND;TZID=Australia/Sydney:20260924T100000", "STATUS:CANCELLED", "SUMMARY:TEST1000 Lab"
    ].join("\n"));
    const occurrences = parseIcsToTimetablePreview(calendar(`${master}\n${exception}`), options).occurrences;
    expect(occurrences).toHaveLength(2);
    expect(occurrences.filter((item) => item.status === "cancelled")).toHaveLength(1);
  });

  it("preserves a Sydney cross-midnight event as increasing absolute instants", () => {
    const ics = calendar(event([
      "UID:overnight", "DTSTART;TZID=Australia/Sydney:20261003T233000", "DTEND;TZID=Australia/Sydney:20261004T010000",
      "SUMMARY:TEST1000 Seminar"
    ].join("\n")));
    const occurrence = parseIcsToTimetablePreview(ics, options).occurrences[0];
    expect(new Date(occurrence.endAt).getTime()).toBeGreaterThan(new Date(occurrence.startAt).getTime());
    expect(instantToWallTime(occurrence.startAt).slice(0, 16)).toBe("2026-10-03T23:30");
    expect(instantToWallTime(occurrence.endAt).slice(0, 16)).toBe("2026-10-04T01:00");
  });

  it("rejects an invalid import timezone", () => {
    const ics = calendar(event("UID:invalid-zone\nDTSTART:20260801T090000\nDTEND:20260801T100000\nSUMMARY:TEST1000 Lecture"));
    expect(() => parseIcsToTimetablePreview(ics, { ...options, timezone: "Mars/Olympus" })).toThrow(/时区/);
  });

  it("rejects malformed ICS", () => {
    expect(() => parseIcsToTimetablePreview("not an ics file", options)).toThrow();
  });

  it("keeps the same external UID isolated by the source identity", () => {
    const ics = calendar(event("UID:shared\nDTSTART:20260801T000000Z\nDTEND:20260801T010000Z\nSUMMARY:TEST1000 Lecture"));
    const one = parseIcsToTimetablePreview(ics, options);
    const two = parseIcsToTimetablePreview(ics.replace("TEST1000", "TEST2000"), options);
    expect(one.occurrences[0].externalUid).toBe(two.occurrences[0].externalUid);
    expect(one.source.sourceKey).not.toBe(two.source.sourceKey);
  });

  it("classifies loopback, private, metadata and public addresses", () => {
    expect(isPrivateOrReservedAddress("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedAddress("10.1.2.3")).toBe(true);
    expect(isPrivateOrReservedAddress("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedAddress("::1")).toBe(true);
    expect(isPrivateOrReservedAddress("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("accepts a bounded public calendar feed", async () => {
    const text = calendar(event("UID:feed\nDTSTART:20260801T000000Z\nDTEND:20260801T010000Z\nSUMMARY:TEST1000 Lecture"));
    const result = await fetchCalendarFeedText("https://calendar.example/feed.ics", {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }],
      fetcher: async () => new Response(text, { headers: { "content-type": "text/calendar" } })
    });
    expect(result).toContain("BEGIN:VCALENDAR");
  });

  it("revalidates and blocks a redirect to a private target", async () => {
    let requests = 0;
    await expect(fetchCalendarFeedText("https://calendar.example/feed.ics", {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }],
      fetcher: async () => {
        requests += 1;
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private.ics" } });
      }
    })).rejects.toThrow(/不允许/);
    expect(requests).toBe(1);
  });

  it("rejects a feed whose declared response is too large", async () => {
    await expect(fetchCalendarFeedText("https://calendar.example/feed.ics", {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }],
      fetcher: async () => new Response("BEGIN:VCALENDAR", { headers: { "content-type": "text/calendar", "content-length": "6000000" } })
    })).rejects.toThrow(/过大/);
  });

  it("rejects an HTML response before ICS parsing", async () => {
    await expect(fetchCalendarFeedText("https://calendar.example/feed.ics", {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }],
      fetcher: async () => new Response("<html>login</html>", { headers: { "content-type": "text/html" } })
    })).rejects.toThrow(/内容类型/);
  });

  it("rejects a private Feed URL even when ICS text is supplied separately", async () => {
    const ics = calendar(event("UID:private-feed\nDTSTART:20260801T000000Z\nDTEND:20260801T010000Z\nSUMMARY:TEST1000 Lecture"));
    const service = new TimetableService({} as TimetableRepository);
    const result = await service.previewTimetable({ icsText: ics, feedUrl: "http://127.0.0.1/private.ics" });
    expect(result.error).toMatch(/不允许/);
  });
});
