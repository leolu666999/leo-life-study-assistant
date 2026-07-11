import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

function ipv4Number(address: string) {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPrivateOrReservedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4]
    ].some(([base, prefix]) => inIpv4Range(address, String(base), Number(prefix)));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8")
      || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")
      || normalized.startsWith("ff")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateOrReservedAddress(mapped) : false;
  }
  return true;
}

type CalendarFeedDependencies = {
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  fetcher?: typeof fetch;
};

async function validatedUrl(value: string, resolve: NonNullable<CalendarFeedDependencies["resolve"]>) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Calendar Feed URL 无效。");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Calendar Feed 只支持 HTTP 或 HTTPS。");
  if (url.username || url.password) throw new Error("Calendar Feed URL 不允许包含用户名或密码。");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Calendar Feed 地址不允许访问本机或局域网。");
  }
  let addresses: Array<{ address: string; family?: number }>;
  try {
    addresses = isIP(hostname) ? [{ address: hostname }] : await resolve(hostname);
  } catch {
    throw new Error("无法解析 Calendar Feed 地址。");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedAddress(address))) {
    throw new Error("Calendar Feed 地址不允许访问本机、私网或保留网络。");
  }
  url.hash = "";
  return url;
}

export async function validateCalendarFeedUrl(feedUrl: string) {
  return (await validatedUrl(feedUrl, (hostname) => lookup(hostname, { all: true, verbatim: true }))).toString();
}

async function responseTextWithLimit(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_BYTES) throw new Error("Calendar Feed 内容过大。");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Calendar Feed 内容过大。");
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export async function fetchCalendarFeedText(feedUrl: string, dependencies: CalendarFeedDependencies = {}) {
  const resolve = dependencies.resolve ?? ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const fetcher = dependencies.fetcher ?? fetch;
  let url = await validatedUrl(feedUrl, resolve);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(url, { cache: "no-store", redirect: "manual", signal: controller.signal,
        headers: { accept: "text/calendar, text/plain;q=0.9, application/octet-stream;q=0.5" } });
    } catch {
      throw new Error("读取 Calendar Feed 失败，请稍后重试。");
    } finally {
      clearTimeout(timeout);
    }
    if (response.status >= 300 && response.status < 400) {
      if (redirect === MAX_REDIRECTS) throw new Error("Calendar Feed 跳转次数过多。");
      const location = response.headers.get("location");
      if (!location) throw new Error("Calendar Feed 返回了无效跳转。");
      url = await validatedUrl(new URL(location, url).toString(), resolve);
      continue;
    }
    if (!response.ok) throw new Error("读取 Calendar Feed 失败，请确认链接有效或需要登录权限。");
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/calendar") && !contentType.includes("text/plain")
      && !contentType.includes("application/ics") && !contentType.includes("application/octet-stream")) {
      throw new Error("Calendar Feed 返回的内容类型不是日历文本。");
    }
    const text = await responseTextWithLimit(response);
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Calendar Feed 内容不是有效的 ICS 日历。");
    return text;
  }
  throw new Error("读取 Calendar Feed 失败。");
}
