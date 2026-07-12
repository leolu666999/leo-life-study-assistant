import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authRuntimeSafetyError } from "@/lib/auth/runtime-guard";

const publicAuthPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/contact-developer", "/api/developer-contact", "/api/auth/login"]);

function authConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export async function middleware(request: NextRequest) {
  const safetyError = authRuntimeSafetyError(process.env);
  if (safetyError) {
    console.error(`MyAssist refused unsafe Auth test mode: ${safetyError}`);
    return new NextResponse(`MyAssist Auth test mode refused to run: ${safetyError}`, { status: 503 });
  }

  if (process.env.AUTH_REQUIRED !== "true") return NextResponse.next();

  const configuration = authConfiguration();
  if (!configuration) {
    return new NextResponse("MyAssist Auth configuration is incomplete", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublicAuthPath = publicAuthPaths.has(path) || path.startsWith("/auth/");

  if (!user && !isPublicAuthPath) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (path === "/login" || path === "/register")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|images/|manifest.webmanifest|sw.js|offline.html|favicon.ico).*)"]
};
