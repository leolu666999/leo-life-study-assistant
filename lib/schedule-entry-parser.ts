import { parseScheduleTime } from "@/lib/schedule-time";

export type ParsedScheduleEntry = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  sourceText: string;
  confidence: number;
  warnings: string[];
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(year: number, month: number, day: number) {
  const value = new Date(year, month - 1, day, 12);
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day ? dateKey(value) : null;
}

function parseDate(source: string, baseDate: Date) {
  const relative = source.match(/(今天|明天|后天)/);
  if (relative) {
    const value = new Date(baseDate);
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() + (relative[1] === "明天" ? 1 : relative[1] === "后天" ? 2 : 0));
    return { date: dateKey(value), text: relative[0] };
  }

  const full = source.match(/\b(20\d{2})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})\s*(?:日|号)?/);
  if (full) {
    const date = validDate(Number(full[1]), Number(full[2]), Number(full[3]));
    if (date) return { date, text: full[0] };
  }

  const short = source.match(/(?:^|\s)(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (short) {
    const month = Number(short[1]);
    const day = Number(short[2]);
    let year = baseDate.getFullYear();
    let date = validDate(year, month, day);
    if (date && date < dateKey(baseDate)) date = validDate(year + 1, month, day);
    if (date) return { date, text: short[0].trim() };
  }

  return { date: dateKey(baseDate), text: "" };
}

function extractLocation(source: string) {
  const explicit = source.match(/(?:地点|地址|场地|Location|Venue)\s*[:：]\s*([^\n]+)/i);
  if (explicit) return { location: explicit[1].trim(), text: explicit[0] };
  const line = source
    .split(/\n+/)
    .map((item) => item.trim())
    .find((item) => /(?:Building|Room|Theatre|Campus|教室|会议室|图书馆|咖啡店)/i.test(item));
  return line ? { location: line, text: line } : { location: "", text: "" };
}

function cleanTitle(source: string, remove: string[]) {
  let value = source;
  for (const text of remove) {
    if (text) value = value.replace(text, " ");
  }
  return value
    .replace(/(?:地点|地址|场地|Location|Venue)\s*[:：]\s*/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/^[\s,，。:：;；\-–—·]+|[\s,，。:：;；\-–—·]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseScheduleEntry(text: string, baseDate = new Date()): ParsedScheduleEntry {
  const source = text.replace(/\u00a0/g, " ").trim();
  const parsedDate = parseDate(source, baseDate);
  const parsedTime = parseScheduleTime(source);
  const parsedLocation = extractLocation(source);
  const title = cleanTitle(source, [parsedDate.text, parsedTime?.parsedTimeText ?? "", parsedLocation.text]) || "新日程";
  const warnings: string[] = [];
  if (!parsedTime) warnings.push("没有识别到时间，请手动确认开始和结束时间。");
  if (!parsedDate.text) warnings.push("没有识别到日期，已使用当前选中的日期。");

  return {
    title,
    date: parsedDate.date,
    startTime: parsedTime?.startTime ?? "09:00",
    endTime: parsedTime?.endTime ?? "10:00",
    location: parsedLocation.location,
    sourceText: source,
    confidence: parsedTime ? (parsedDate.text ? 0.96 : 0.88) : 0.55,
    warnings
  };
}

export function scheduleEntryTodoContent(entry: Pick<ParsedScheduleEntry, "title" | "startTime" | "endTime" | "location">) {
  const location = entry.location.trim();
  return `${entry.startTime}-${entry.endTime} ${entry.title.trim()}${location ? ` · 地点：${location}` : ""}`.trim();
}

export function todoScheduleLocation(content: string) {
  return content.match(/(?:^|[·\s])(?:地点|地址)\s*[:：]\s*(.+)$/)?.[1]?.trim() ?? "";
}
