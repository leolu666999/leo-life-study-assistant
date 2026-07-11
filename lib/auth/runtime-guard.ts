type RuntimeEnvironment = Record<string, string | undefined>;

export function authRuntimeSafetyError(env: RuntimeEnvironment) {
  if (env.AUTH_REQUIRED !== "true" || (env.DATA_BACKEND || "sqlite") !== "sqlite") return null;
  if (env.TEST_DATABASE !== "true") return "TEST_DATABASE must be true";

  const root = env.AUTH_TEST_DATA_ROOT?.replace(/\/+$/, "");
  if (!root) return "AUTH_TEST_DATA_ROOT is required";

  const paths = [
    env.LEO_APP_DATA_DIR,
    env.LEO_DATA_DIR,
    env.LEO_UPLOADS_DIR,
    env.LEO_DB_PATH,
    env.LEO_LOG_DIR
  ];
  if (paths.some((value) => !value)) return "all isolated data paths must be explicit";
  if (paths.some((value) => value!.includes("/Library/Application Support/"))) {
    return "Application Support data is forbidden in Auth test mode";
  }
  if (paths.some((value) => value !== root && !value!.startsWith(`${root}/`))) {
    return "all isolated data paths must be inside AUTH_TEST_DATA_ROOT";
  }
  return null;
}
