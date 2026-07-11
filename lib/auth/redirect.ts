const authPages = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "http://myassist.local");
    if (url.origin !== "http://myassist.local" || authPages.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
