import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertAdmin } from "@/lib/auth/admin";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  } as const;
}

export function createSupabaseAuthClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    clientOptions()
  );
}

function createSupabaseBearerClient(token: string): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      ...clientOptions(),
      global: { headers: { Authorization: `Bearer ${token}` } }
    }
  );
}

function requestCookies(request: Request) {
  const header = request.headers.get("cookie");
  if (!header) return [];

  return header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name) return [];
    try {
      return [{ name, value: decodeURIComponent(rawValue) }];
    } catch {
      return [{ name, value: rawValue }];
    }
  });
}

function createSupabaseRequestClient(request: Request): SupabaseClient {
  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => requestCookies(request),
        // Middleware refreshes sessions and writes response cookies.
        setAll: () => undefined
      }
    }
  );
}

export function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
    clientOptions()
  );
}

function sessionCookieOptions(options: Record<string, unknown>) {
  const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
  return sessionOptions;
}

export async function createSupabaseServerClient(options: { sessionOnly?: boolean } = {}) {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              cookieStore.set(name, value, options.sessionOnly ? sessionCookieOptions(cookieOptions) : cookieOptions);
            });
          } catch {
            // Server Components cannot write cookies; middleware refreshes them.
          }
        }
      }
    }
  );
}

export async function currentSessionUser(): Promise<User | null> {
  const { data, error } = await (await createSupabaseServerClient()).auth.getUser();
  return error ? null : data.user;
}

export async function authenticatedRequestUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) return null;
    const { data, error } = await createSupabaseAuthClient().auth.getUser(token);
    return error ? null : data.user;
  }
  try {
    const { data, error } = await createSupabaseRequestClient(request).auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export async function authenticatedRequestContext(request: Request): Promise<{ client: SupabaseClient; user: User } | null> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) return null;
    const client = createSupabaseBearerClient(token);
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : { client, user: data.user };
  }
  try {
    const client = createSupabaseRequestClient(request);
    const { data, error } = await client.auth.getUser();
    return error || !data.user ? null : { client, user: data.user };
  } catch {
    return null;
  }
}

export async function assertAdminRequest(request: Request) {
  const user = await authenticatedRequestUser(request);
  assertAdmin(user);
  return user!;
}
