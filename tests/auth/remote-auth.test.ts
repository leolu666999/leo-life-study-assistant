import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { GET as getAdminStats } from "@/app/api/admin/system/stats/route";
import { GET as getCurrentIdentity } from "@/app/api/auth/me/route";

type StoredCookie = { name: string; value: string; options?: CookieOptionsWithName };
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote Auth tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const userAEmail = required("SUPABASE_TEST_USER_A_EMAIL");
const userAPassword = required("SUPABASE_TEST_USER_A_PASSWORD");
const adminEmail = required("SUPABASE_TEST_ADMIN_EMAIL");
const adminPassword = required("SUPABASE_TEST_ADMIN_PASSWORD");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "myassist-auth-remote-"));

let admin: SupabaseClient;
let userASession: Session;
let adminSession: Session;
let cookies = new Map<string, StoredCookie>();
let temporaryUserId: string | undefined;
const temporaryEmail = `myassist-phase3-${Date.now()}@example.com`;
const temporaryUsername = `phase3_${Date.now()}`.slice(0, 24);
const temporaryPassword = `P3-${crypto.randomUUID()}!aA`;
const updatedTemporaryPassword = `${temporaryPassword}Z9`;

function publicClient() {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function ssrClient(store: Map<string, StoredCookie>) {
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...store.values()].map(({ name, value }) => ({ name, value })),
      setAll: (values) => values.forEach((cookie) => store.set(cookie.name, cookie))
    }
  });
}

function cookieHeader(store = cookies) {
  return [...store.values()].map(({ name, value }) => `${name}=${value}`).join("; ");
}

function requestWithCookies(target: string) {
  const request = new NextRequest(target);
  cookies.forEach(({ name, value }) => request.cookies.set(name, value));
  return request;
}

async function signIn(email: string, password: string) {
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error("Missing test session");
  return data.session;
}

beforeAll(async () => {
  Object.assign(process.env, {
    AUTH_REQUIRED: "true",
    DATA_BACKEND: "sqlite",
    TEST_DATABASE: "true",
    AUTH_TEST_DATA_ROOT: root,
    LEO_APP_DATA_DIR: root,
    LEO_DATA_DIR: path.join(root, "data"),
    LEO_UPLOADS_DIR: path.join(root, "uploads"),
    LEO_DB_PATH: path.join(root, "data", "auth-test.db"),
    LEO_LOG_DIR: path.join(root, "logs")
  });
  admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  userASession = await signIn(userAEmail, userAPassword);
  adminSession = await signIn(adminEmail, adminPassword);
  const client = ssrClient(cookies);
  const { error } = await client.auth.setSession({ access_token: userASession.access_token, refresh_token: userASession.refresh_token });
  if (error) throw error;
}, 60_000);

afterAll(async () => {
  if (temporaryUserId) await admin.auth.admin.deleteUser(temporaryUserId);
  fs.rmSync(root, { recursive: true, force: true });
}, 60_000);

describe.sequential("real Supabase Auth lifecycle", () => {
  it("1. valid credentials log in", async () => {
    expect(userASession.user.email).toBe(userAEmail);
  });

  it("2. invalid credentials are rejected", async () => {
    const { error } = await publicClient().auth.signInWithPassword({ email: userAEmail, password: "definitely-wrong" });
    expect(error).not.toBeNull();
  });

  it("3. registration creates one isolated Auth user", async () => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email: temporaryEmail, password: temporaryPassword, options: { data: { username: temporaryUsername } } });
    expect(error).toBeNull();
    temporaryUserId = data.user?.id;
    expect(temporaryUserId).toBeTruthy();
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new Error("Missing signup token hash");
    const { error: verifyError } = await publicClient().auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
    expect(verifyError).toBeNull();
    const { data: found } = await admin.auth.admin.getUserById(temporaryUserId!);
    expect(found.user?.email).toBe(temporaryEmail);
  });

  it("4. duplicate registration does not create a second Auth user", async () => {
    const { error } = await admin.auth.admin.generateLink({ type: "signup", email: temporaryEmail, password: temporaryPassword, options: { data: { username: temporaryUsername } } });
    expect(error).not.toBeNull();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.filter((user) => user.email === temporaryEmail)).toHaveLength(1);
  });

  it("5. new registration initializes profile and settings", async () => {
    const [{ count: profiles }, { count: settings }] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("user_id", temporaryUserId!),
      admin.from("settings").select("*", { count: "exact", head: true }).eq("user_id", temporaryUserId!)
    ]);
    expect(profiles).toBe(1);
    expect(settings).toBe(4);
  });

  it("6. forgot-password endpoint responds without exposing account state", async () => {
    const { error } = await publicClient().auth.resetPasswordForEmail(temporaryEmail, { redirectTo: "http://localhost:3011/auth/callback?next=%2Freset-password" });
    expect(error === null || error.status === 429 || error.code === "email_address_invalid").toBe(true);
  });

  it("7. a verified recovery flow can set a new password", async () => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: temporaryEmail });
    expect(error).toBeNull();
    const tokenHash = data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();
    if (!tokenHash) throw new Error("Missing recovery token hash");
    const recovery = publicClient();
    const { error: verifyError } = await recovery.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    expect(verifyError).toBeNull();
    const { error: updateError } = await recovery.auth.updateUser({ password: updatedTemporaryPassword });
    expect(updateError).toBeNull();
    expect((await signIn(temporaryEmail, updatedTemporaryPassword)).user.id).toBe(temporaryUserId);
  });

  it("8. SSR cookies restore the same user after a fresh client instance", async () => {
    const { data, error } = await ssrClient(new Map(cookies)).auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userASession.user.id);
  });

  it("9. local sign-out removes the SSR session", async () => {
    const signoutCookies = new Map(cookies);
    const client = ssrClient(signoutCookies);
    expect((await client.auth.signOut({ scope: "local" })).error).toBeNull();
    expect((await ssrClient(signoutCookies).auth.getUser()).data.user).toBeNull();
  });
});

describe.sequential("middleware and account boundaries", () => {
  beforeAll(async () => {
    userASession = await signIn(userAEmail, userAPassword);
    cookies = new Map();
    const { error } = await ssrClient(cookies).auth.setSession({
      access_token: userASession.access_token,
      refresh_token: userASession.refresh_token
    });
    if (error) throw error;
  });

  it("10. anonymous private page is redirected to login", async () => {
    const response = await middleware(new NextRequest("http://localhost:3011/tasks"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Ftasks");
  });

  it("11. anonymous private API receives 401", async () => {
    const response = await middleware(new NextRequest("http://localhost:3011/api/tasks"));
    expect(response.status).toBe(401);
  });

  it("12. anonymous Admin API receives 401 before reaching the handler", async () => {
    const response = await middleware(new NextRequest("http://localhost:3011/api/admin/system/stats"));
    expect(response.status).toBe(401);
  });

  it("13. login and password recovery pages remain public", async () => {
    expect((await middleware(new NextRequest("http://localhost:3011/login"))).status).toBe(200);
    expect((await middleware(new NextRequest("http://localhost:3011/forgot-password"))).status).toBe(200);
  });

  it("14. an SSR-authenticated user can enter a private page", async () => {
    const response = await middleware(requestWithCookies("http://localhost:3011/tasks"));
    expect(response.status).toBe(200);
  });

  it("15. an authenticated user is redirected away from login", async () => {
    const response = await middleware(requestWithCookies("http://localhost:3011/login"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3011/");
  });

  it("16. Personal Account receives 403 from the server Admin API", async () => {
    const freshPersonalSession = await signIn(userAEmail, userAPassword);
    const response = await getAdminStats(new Request("http://localhost/api/admin/system/stats", { headers: { authorization: `Bearer ${freshPersonalSession.access_token}` } }));
    expect(response.status).toBe(403);
  });

  it("17. Admin Account reaches the protected server Admin API", async () => {
    const response = await getAdminStats(new Request("http://localhost/api/admin/system/stats", { headers: { authorization: `Bearer ${adminSession.access_token}` } }));
    expect(response.status).toBe(200);
  });

  it("18. client-supplied user_id cannot replace the authenticated identity", async () => {
    const freshPersonalSession = await signIn(userAEmail, userAPassword);
    const response = await getCurrentIdentity(new Request(`http://localhost/api/auth/me?user_id=${adminSession.user.id}`, {
      headers: { authorization: `Bearer ${freshPersonalSession.access_token}`, "x-user-id": adminSession.user.id }
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(freshPersonalSession.user.id);
    expect(body.isAdmin).toBe(false);
  });

  it("19. only the configured Admin Account is identified as admin", async () => {
    const response = await getCurrentIdentity(new Request("http://localhost/api/auth/me", {
      headers: { authorization: `Bearer ${adminSession.access_token}` }
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).isAdmin).toBe(true);
  });

  it("20. unsafe Auth configuration fails closed with 503", async () => {
    const previous = process.env.TEST_DATABASE;
    process.env.TEST_DATABASE = "false";
    const response = await middleware(new NextRequest("http://localhost:3011/login"));
    process.env.TEST_DATABASE = previous;
    expect(response.status).toBe(503);
  });
});
