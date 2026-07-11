import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateAuthDataMode } from "./auth/data-mode";

export const appName = "MyAssist";
export const legacyDataAppName = "Leo的生活学习助手";
export const defaultPort = Number(process.env.LEO_PORT || process.env.PORT || 3011);
export const dataBackend = process.env.DATA_BACKEND?.trim() || "sqlite";
export const authRequired = process.env.AUTH_REQUIRED === "true";
export const testDatabase = process.env.TEST_DATABASE === "true";

const realAppSupportDir = path.join(os.homedir(), "Library", "Application Support", legacyDataAppName);

export const appSupportDir =
  process.env.LEO_APP_DATA_DIR ||
  realAppSupportDir;

export const appLogDir =
  process.env.LEO_LOG_DIR ||
  path.join(os.homedir(), "Library", "Logs", legacyDataAppName);

export const dataDir = process.env.LEO_DATA_DIR || path.join(appSupportDir, "data");
export const uploadsDir = process.env.LEO_UPLOADS_DIR || path.join(appSupportDir, "uploads");
export const dbPath = process.env.LEO_DB_PATH || path.join(dataDir, "leo_life_study.db");

export const legacyDataDir = path.join(process.cwd(), "data");
export const legacyUploadsDir = path.join(process.cwd(), "uploads");
export const legacyDbPath = path.join(legacyDataDir, "leo_life_study.db");

export const appDataMode = validateAuthDataMode({
  authRequired,
  dataBackend,
  testDatabase,
  appSupportDir,
  dataDir,
  uploadsDir,
  dbPath,
  logDir: appLogDir,
  tempRoot: os.tmpdir(),
  authTestDataRoot: process.env.AUTH_TEST_DATA_ROOT,
  realAppSupportDir,
  explicitPaths: {
    appSupportDir: Boolean(process.env.LEO_APP_DATA_DIR),
    dataDir: Boolean(process.env.LEO_DATA_DIR),
    uploadsDir: Boolean(process.env.LEO_UPLOADS_DIR),
    dbPath: Boolean(process.env.LEO_DB_PATH),
    logDir: Boolean(process.env.LEO_LOG_DIR)
  }
});

export function ensureUserDataDirectories() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(appLogDir, { recursive: true });
}

function copyIfPresent(source: string, target: string) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.copyFileSync(source, target);
}

function copyUploadsIfNeeded() {
  if (!fs.existsSync(legacyUploadsDir)) return;
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const entry of fs.readdirSync(legacyUploadsDir)) {
    if (entry === ".gitkeep") continue;
    const source = path.join(legacyUploadsDir, entry);
    const target = path.join(uploadsDir, entry);
    const stats = fs.statSync(source);
    if (stats.isFile()) copyIfPresent(source, target);
  }
}

export function migrateLegacyUserDataIfNeeded() {
  ensureUserDataDirectories();
  if (appDataMode === "auth-test") return;
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
    copyIfPresent(legacyDbPath, dbPath);
    copyIfPresent(`${legacyDbPath}-wal`, `${dbPath}-wal`);
    copyIfPresent(`${legacyDbPath}-shm`, `${dbPath}-shm`);
  }
  copyUploadsIfNeeded();
}
