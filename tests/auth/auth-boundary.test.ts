import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { authRuntimeSafetyError } from "@/lib/auth/runtime-guard";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { safeRedirectPath } from "@/lib/auth/redirect";

const safeEnvironment = {
  AUTH_REQUIRED: "true",
  DATA_BACKEND: "sqlite",
  TEST_DATABASE: "true",
  AUTH_TEST_DATA_ROOT: "/tmp/myassist-auth-test",
  LEO_APP_DATA_DIR: "/tmp/myassist-auth-test",
  LEO_DATA_DIR: "/tmp/myassist-auth-test/data",
  LEO_UPLOADS_DIR: "/tmp/myassist-auth-test/uploads",
  LEO_DB_PATH: "/tmp/myassist-auth-test/data/auth.db",
  LEO_LOG_DIR: "/tmp/myassist-auth-test/logs"
};

describe("Auth runtime boundary", () => {
  it("does not change local mode", () => {
    expect(authRuntimeSafetyError({ AUTH_REQUIRED: "false" })).toBeNull();
  });

  it("accepts a fully isolated Auth test configuration", () => {
    expect(authRuntimeSafetyError(safeEnvironment)).toBeNull();
  });

  it("rejects a missing test database marker", () => {
    expect(authRuntimeSafetyError({ ...safeEnvironment, TEST_DATABASE: "false" })).toMatch(/TEST_DATABASE/);
  });

  it("rejects implicit data paths", () => {
    expect(authRuntimeSafetyError({ ...safeEnvironment, LEO_DB_PATH: undefined })).toMatch(/explicit/);
  });

  it("rejects Application Support paths", () => {
    expect(authRuntimeSafetyError({
      ...safeEnvironment,
      LEO_DB_PATH: "/Users/example/Library/Application Support/Leo的生活学习助手/data/leo_life_study.db"
    })).toMatch(/Application Support/);
  });

  it("rejects paths outside the dedicated Auth root", () => {
    expect(authRuntimeSafetyError({ ...safeEnvironment, LEO_UPLOADS_DIR: "/tmp/other/uploads" })).toMatch(/AUTH_TEST_DATA_ROOT/);
  });

  it("rejects cloud mode when Auth is disabled", () => {
    expect(authRuntimeSafetyError({ DATA_BACKEND: "supabase", AUTH_REQUIRED: "false" })).toMatch(/requires AUTH_REQUIRED/);
  });

  it("fails closed when a Vercel deployment is not explicitly Cloud mode", () => {
    expect(authRuntimeSafetyError({ VERCEL: "1", DATA_BACKEND: "sqlite", AUTH_REQUIRED: "false" })).toMatch(/Vercel requires DATA_BACKEND/);
  });

  it("accepts Vercel only with complete Cloud and server-only configuration", () => {
    const cloud = {
      VERCEL: "1", DATA_BACKEND: "supabase", FILE_BACKEND: "supabase", AUTH_REQUIRED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test",
      SUPABASE_SECRET_KEY: "server-only-test", ADMIN_USER_ID: "00000000-0000-4000-8000-000000000001"
    };
    expect(authRuntimeSafetyError(cloud)).toBeNull();
    for (const name of ["FILE_BACKEND", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "ADMIN_USER_ID"]) {
      expect(authRuntimeSafetyError({ ...cloud, [name]: undefined })).toMatch(new RegExp(name));
    }
  });
});

describe("Auth redirect safety", () => {
  it("builds localhost 3011 auth callback URLs", () => {
    expect(buildAuthCallbackUrl("http://localhost:3011", "/reset-password")).toBe("http://localhost:3011/auth/callback?next=%2Freset-password");
  });

  it("builds Vercel HTTPS auth callback URLs", () => {
    expect(buildAuthCallbackUrl("https://myassist-test.vercel.app", "/")).toBe("https://myassist-test.vercel.app/auth/callback?next=%2F");
  });

  it("keeps a local application path", () => {
    expect(safeRedirectPath("/tasks?status=all")).toBe("/tasks?status=all");
  });

  it("rejects a protocol-relative external redirect", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/");
  });

  it("rejects an absolute external redirect", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
  });

  it("does not redirect back into the login loop", () => {
    expect(safeRedirectPath("/login")).toBe("/");
  });
});

describe("Public landing boundary", () => {
  it("keeps only the product root public while private pages stay protected", () => {
    const middlewareSource = fs.readFileSync("middleware.ts", "utf8");
    const pageSource = fs.readFileSync("app/page.tsx", "utf8");
    expect(middlewareSource).toContain('new Set(["/", "/login", "/register"');
    expect(pageSource).toContain("if (!user) return <LandingPage />");
    expect(pageSource).toContain('return <LeoApp initialView="dashboard" />');
    expect(fs.existsSync("components/landing-page.tsx")).toBe(true);
    expect(fs.existsSync("public/images/myassist-landing-hero.webp")).toBe(true);
  });
});
