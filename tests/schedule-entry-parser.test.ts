import { describe, expect, it } from "vitest";
import { parseScheduleEntry, scheduleEntryTodoContent, todoScheduleLocation } from "@/lib/schedule-entry-parser";

describe("schedule entry parser", () => {
  const base = new Date(2026, 6, 16, 12);

  it("parses a Chinese event with date, time and location", () => {
    const result = parseScheduleEntry("7月20日 上午10点到11点 Coffee chat\n地点：Fisher Library", base);
    expect(result).toMatchObject({
      date: "2026-07-20",
      startTime: "10:00",
      endTime: "11:00",
      title: "Coffee chat",
      location: "Fisher Library"
    });
  });

  it("parses relative date and inherited evening period", () => {
    const result = parseScheduleEntry("明天晚上7点到8点半 健身", base);
    expect(result).toMatchObject({ date: "2026-07-17", startTime: "19:00", endTime: "20:30", title: "健身" });
  });

  it("recognizes Chinese-number hours used in natural To Do titles", () => {
    const result = parseScheduleEntry("早上八点到十点 coffee chat", base);
    expect(result).toMatchObject({ startTime: "08:00", endTime: "10:00", title: "coffee chat" });
  });

  it("falls back to editable defaults when OCR text has no time", () => {
    const result = parseScheduleEntry("Student welcome event\nLocation: Great Hall", base);
    expect(result.startTime).toBe("09:00");
    expect(result.warnings).toContain("没有识别到时间，请手动确认开始和结束时间。");
  });

  it("serializes one To Do source of truth and extracts its location", () => {
    const content = scheduleEntryTodoContent({ title: "Coffee chat", startTime: "08:00", endTime: "10:00", location: "Camperdown" });
    expect(content).toBe("08:00-10:00 Coffee chat · 地点：Camperdown");
    expect(todoScheduleLocation(content)).toBe("Camperdown");
  });
});
