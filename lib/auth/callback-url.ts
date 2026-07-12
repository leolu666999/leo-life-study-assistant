export function buildAuthCallbackUrl(origin: string, nextPath = "/") {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  return `${normalizedOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
