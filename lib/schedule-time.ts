export type ParsedScheduleTime = {
  startTime: string;
  endTime: string;
  parsedTimeText: string;
  title: string;
  confidence: number;
};

type TimeToken = {
  start: number;
  end: number;
  text: string;
  period: string;
  hour: number;
  minute: number;
};

const timeTokenPattern =
  /(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*([01]?\d|2[0-3]|[一二三四五六七八九十]{1,3})\s*(?:(?:[:：]\s*([0-5]\d))|(?:点(?:\s*(半|[0-5]?\d\s*分?|[一二三四五六七八九十]{1,3}\s*分?))?))/g;

function parseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  const [before, after] = value.split("十");
  if (value.includes("十")) return (before ? digits[before] ?? 0 : 1) * 10 + (after ? digits[after] ?? 0 : 0);
  return digits[value] ?? Number.NaN;
}

function parseMinute(value?: string) {
  if (!value) return 0;
  if (value.trim() === "半") return 30;
  return parseNumber(value.replace(/\s*分\s*$/, "").trim() || "0");
}

function collectTimeTokens(text: string) {
  const tokens: TimeToken[] = [];
  for (const match of text.matchAll(timeTokenPattern)) {
    const start = match.index ?? 0;
    tokens.push({
      start,
      end: start + match[0].length,
      text: match[0],
      period: match[1] ?? "",
      hour: parseNumber(match[2]),
      minute: parseMinute(match[3] ?? match[4])
    });
  }
  return tokens;
}

function hour24(hour: number, period: string) {
  if (period === "凌晨") return hour === 12 ? 0 : hour;
  if (period === "早上" || period === "上午") return hour === 12 ? 0 : hour;
  if (period === "中午") return hour < 11 ? hour + 12 : hour;
  if (period === "下午" || period === "傍晚" || period === "晚上") return hour < 12 ? hour + 12 : hour;
  return hour;
}

function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function cleanTitle(text: string, start: number, end: number) {
  return `${text.slice(0, start)} ${text.slice(end)}`
    .replace(/^[\s,，。:：;；\-–—]+|[\s,，。:：;；\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim() || text.trim();
}

export function parseScheduleTime(text: string): ParsedScheduleTime | null {
  const source = text.trim();
  if (!source) return null;
  const tokens = collectTimeTokens(source);
  if (tokens.length === 0) return null;

  const first = tokens[0];
  const second = tokens[1];
  const separator = second ? source.slice(first.end, second.start) : "";
  const isRange = Boolean(second && /^\s*(?:-|–|—|~|～|到|至)\s*$/.test(separator));
  const inheritedPeriod = first.period || "";
  const startMinutes = hour24(first.hour, first.period) * 60 + first.minute;

  if (isRange && second) {
    const endPeriod = second.period || inheritedPeriod;
    let endMinutes = hour24(second.hour, endPeriod) * 60 + second.minute;
    if (endMinutes <= startMinutes && !second.period && !inheritedPeriod) endMinutes += 12 * 60;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    const parsedEnd = second.end;
    return {
      startTime: formatTime(startMinutes),
      endTime: formatTime(endMinutes),
      parsedTimeText: source.slice(first.start, parsedEnd),
      title: cleanTitle(source, first.start, parsedEnd),
      confidence: 1
    };
  }

  return {
    startTime: formatTime(startMinutes),
    endTime: formatTime(startMinutes + 30),
    parsedTimeText: first.text.trim(),
    title: cleanTitle(source, first.start, first.end),
    confidence: 0.85
  };
}
