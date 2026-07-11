import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
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

export function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
    clientOptions()
  );
}

export async function authenticatedRequestUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;
  const { data, error } = await createSupabaseAuthClient().auth.getUser(token);
  return error ? null : data.user;
}

export async function assertAdminRequest(request: Request) {
  const user = await authenticatedRequestUser(request);
  assertAdmin(user);
  return user!;
}
