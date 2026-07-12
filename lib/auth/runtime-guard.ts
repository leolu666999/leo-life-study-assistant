type RuntimeEnvironment = Record<string, string | undefined>;

export function authRuntimeSafetyError(env: RuntimeEnvironment) {
  const backend = env.DATA_BACKEND || "sqlite";
  const isVercel = env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
  if (isVercel) {
    if (backend !== "supabase") return "Vercel requires DATA_BACKEND=supabase";
    if (env.FILE_BACKEND !== "supabase") return "Vercel requires FILE_BACKEND=supabase";
    if (env.AUTH_REQUIRED !== "true") return "Vercel requires AUTH_REQUIRED=true";
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "ADMIN_USER_ID"
    ]) {
      if (!env[name]?.trim()) return `Vercel requires ${name}`;
    }
  }
  if (backend === "supabase" && env.AUTH_REQUIRED !== "true") {
    return "DATA_BACKEND=supabase requires AUTH_REQUIRED=true";
  }
  if (backend !== "sqlite" || env.AUTH_REQUIRED !== "true") return null;
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
