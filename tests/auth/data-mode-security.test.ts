import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UnsafeAuthDataModeError, validateAuthDataMode } from "@/lib/auth/data-mode";

const tempRoot = os.tmpdir();
const authRoot = path.join(tempRoot, "myassist-auth-test");
const realRoot = path.join(os.homedir(), "Library", "Application Support", "Leo的生活学习助手");

function validInput() {
  return {
    authRequired: true,
    dataBackend: "sqlite",
    testDatabase: true,
    appSupportDir: authRoot,
    dataDir: path.join(authRoot, "data"),
    uploadsDir: path.join(authRoot, "uploads"),
    dbPath: path.join(authRoot, "data", "auth-test.db"),
    logDir: path.join(authRoot, "logs"),
    tempRoot,
    authTestDataRoot: authRoot,
    realAppSupportDir: realRoot,
    explicitPaths: {
      appSupportDir: true,
      dataDir: true,
      uploadsDir: true,
      dbPath: true,
      logDir: true
    }
  };
}

describe("Auth test data-mode guard", () => {
  it("keeps the default local mode unchanged when Auth is disabled", () => {
    expect(validateAuthDataMode({ ...validInput(), authRequired: false, testDatabase: false })).toBe("local");
  });

  it("accepts an explicitly isolated SQLite database under the system temp directory", () => {
    expect(validateAuthDataMode(validInput())).toBe("auth-test");
  });

  it("fails closed without TEST_DATABASE=true", () => {
    expect(() => validateAuthDataMode({ ...validInput(), testDatabase: false })).toThrow(UnsafeAuthDataModeError);
  });

  it("fails closed without a dedicated Auth test data root", () => {
    expect(() => validateAuthDataMode({ ...validInput(), authTestDataRoot: undefined })).toThrow(/AUTH_TEST_DATA_ROOT/);
  });

  it("fails closed when any test path was not explicitly configured", () => {
    expect(() => validateAuthDataMode({
      ...validInput(),
      explicitPaths: { ...validInput().explicitPaths, dbPath: false }
    })).toThrow(/must be explicit/);
  });

  it("rejects the real Application Support database", () => {
    expect(() => validateAuthDataMode({
      ...validInput(),
      appSupportDir: realRoot,
      dataDir: path.join(realRoot, "data"),
      dbPath: path.join(realRoot, "data", "leo_life_study.db")
    })).toThrow(/protected local data/);
  });

  it("rejects a database outside the system temporary directory", () => {
    expect(() => validateAuthDataMode({
      ...validInput(),
      appSupportDir: "/Users/shared/myassist-test",
      dataDir: "/Users/shared/myassist-test/data",
      uploadsDir: "/Users/shared/myassist-test/uploads",
      dbPath: "/Users/shared/myassist-test/data/test.db",
      logDir: "/Users/shared/myassist-test/logs"
    })).toThrow(/system temporary directory/);
  });

  it("rejects a database path outside its declared data directory", () => {
    expect(() => validateAuthDataMode({
      ...validInput(),
      dbPath: path.join(authRoot, "other", "test.db")
    })).toThrow(/inside LEO_DATA_DIR/);
  });

  it("reserves non-SQLite Auth for the future cloud mode", () => {
    expect(validateAuthDataMode({ ...validInput(), dataBackend: "supabase" })).toBe("cloud");
  });
});
