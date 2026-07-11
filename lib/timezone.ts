function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function zonedWallTimeToUtc(date: string, time: string, timeZone = "Australia/Sydney") {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const parts = partsInZone(new Date(guess), timeZone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}

export function instantToWallTime(value: string, timeZone = "Australia/Sydney") {
  const parts = partsInZone(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function zonedWallTimeToUtcStrict(date: string, time: string, timeZone = "Australia/Sydney") {
  if (!isValidTimeZone(timeZone)) throw new Error("无效的 IANA 时区。");
  const result = zonedWallTimeToUtc(date, time, timeZone);
  const expected = `${date}T${time.padEnd(8, ":00").slice(0, 8)}`;
  if (instantToWallTime(result, timeZone) !== expected) throw new Error("该本地时间在所选时区中不存在或无法安全转换。");
  return result;
}
