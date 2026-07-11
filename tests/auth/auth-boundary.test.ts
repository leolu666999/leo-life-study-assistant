import { describe, expect, it } from "vitest";
import { authRuntimeSafetyError } from "@/lib/auth/runtime-guard";
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
});

describe("Auth redirect safety", () => {
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
