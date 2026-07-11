import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "myassist-auth-test-"));
const runner = path.join(process.cwd(), "node_modules", "vite-node", "vite-node.mjs");
const fixture = path.join(process.cwd(), "tests", "auth", "fixtures", "open-test-db.ts");
const baseEnvironment = {
  ...process.env,
  AUTH_REQUIRED: "true",
  DATA_BACKEND: "sqlite",
  TEST_DATABASE: "true",
  AUTH_TEST_DATA_ROOT: root,
  LEO_APP_DATA_DIR: root,
  LEO_DATA_DIR: path.join(root, "data"),
  LEO_UPLOADS_DIR: path.join(root, "uploads"),
  LEO_DB_PATH: path.join(root, "data", "auth-test.db"),
  LEO_LOG_DIR: path.join(root, "logs")
};

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("isolated Auth SQLite startup", () => {
  it("creates and opens only the dedicated temporary database", () => {
    const result = spawnSync(process.execPath, [runner, fixture], { cwd: process.cwd(), env: baseEnvironment, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as { dbPath: string; taskCount: number; uploadNames: string[]; backgroundUpdatedAt: string };
    expect(output.dbPath).toBe(baseEnvironment.LEO_DB_PATH);
    expect(output.taskCount).toBe(0);
    expect(output.uploadNames).toEqual([]);
    expect(fs.existsSync(baseEnvironment.LEO_DB_PATH)).toBe(true);

    const secondStart = spawnSync(process.execPath, [runner, fixture], { cwd: process.cwd(), env: baseEnvironment, encoding: "utf8" });
    expect(secondStart.status, secondStart.stderr).toBe(0);
    const secondOutput = JSON.parse(secondStart.stdout) as { backgroundUpdatedAt: string };
    expect(secondOutput.backgroundUpdatedAt).toBe(output.backgroundUpdatedAt);
  });

  it("fails before opening the real Application Support database", () => {
    const realRoot = path.join(os.homedir(), "Library", "Application Support", "Leo的生活学习助手");
    const result = spawnSync(process.execPath, [runner, fixture], {
      cwd: process.cwd(),
      env: {
        ...baseEnvironment,
        AUTH_TEST_DATA_ROOT: realRoot,
        LEO_APP_DATA_DIR: realRoot,
        LEO_DATA_DIR: path.join(realRoot, "data"),
        LEO_UPLOADS_DIR: path.join(realRoot, "uploads"),
        LEO_DB_PATH: path.join(realRoot, "data", "leo_life_study.db"),
        LEO_LOG_DIR: path.join(realRoot, "logs")
      },
      encoding: "utf8"
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Unsafe Auth data mode/);
  });
});
