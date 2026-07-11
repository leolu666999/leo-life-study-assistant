import path from "node:path";

export class UnsafeAuthDataModeError extends Error {
  constructor(message: string) {
    super(`Unsafe Auth data mode: ${message}`);
    this.name = "UnsafeAuthDataModeError";
  }
}

type AuthDataModeInput = {
  authRequired: boolean;
  dataBackend: string;
  testDatabase: boolean;
  appSupportDir: string;
  dataDir: string;
  uploadsDir: string;
  dbPath: string;
  logDir: string;
  tempRoot: string;
  authTestDataRoot: string | undefined;
  realAppSupportDir: string;
  explicitPaths: {
    appSupportDir: boolean;
    dataDir: boolean;
    uploadsDir: boolean;
    dbPath: boolean;
    logDir: boolean;
  };
};

export type AppDataMode = "local" | "auth-test" | "cloud";

function isInside(candidate: string, parent: string) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateAuthDataMode(input: AuthDataModeInput): AppDataMode {
  if (!input.authRequired) return "local";
  if (input.dataBackend !== "sqlite") return "cloud";

  if (!input.testDatabase) {
    throw new UnsafeAuthDataModeError("AUTH_REQUIRED=true with SQLite requires TEST_DATABASE=true");
  }

  if (!input.authTestDataRoot) {
    throw new UnsafeAuthDataModeError("AUTH_TEST_DATA_ROOT is required");
  }

  const authTestDataRoot = path.resolve(input.authTestDataRoot);
  if (!isInside(authTestDataRoot, input.tempRoot)) {
    throw new UnsafeAuthDataModeError("AUTH_TEST_DATA_ROOT must be inside the system temporary directory");
  }

  const missing = Object.entries(input.explicitPaths)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new UnsafeAuthDataModeError(`test paths must be explicit: ${missing.join(", ")}`);
  }

  const protectedRoots = [input.realAppSupportDir, path.join(process.cwd(), "data"), path.join(process.cwd(), "uploads")];
  const isolatedPaths = [input.appSupportDir, input.dataDir, input.uploadsDir, input.dbPath, input.logDir];

  for (const candidate of isolatedPaths) {
    if (protectedRoots.some((root) => isInside(candidate, root))) {
      throw new UnsafeAuthDataModeError(`test path points at protected local data: ${candidate}`);
    }
    if (!isInside(candidate, input.tempRoot)) {
      throw new UnsafeAuthDataModeError(`test path must stay inside the system temporary directory: ${candidate}`);
    }
    if (!isInside(candidate, authTestDataRoot)) {
      throw new UnsafeAuthDataModeError(`test path must stay inside AUTH_TEST_DATA_ROOT: ${candidate}`);
    }
  }

  if (!isInside(input.dbPath, input.dataDir)) {
    throw new UnsafeAuthDataModeError("LEO_DB_PATH must be inside LEO_DATA_DIR");
  }
  if (input.dataDir === input.uploadsDir) {
    throw new UnsafeAuthDataModeError("LEO_DATA_DIR and LEO_UPLOADS_DIR must be separate");
  }

  return "auth-test";
}
