const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(process.cwd(), ".env.supabase-test.local");

function readEnv() {
  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

function randomPassword() {
  return `${crypto.randomBytes(24).toString("base64url")}aA1!`;
}

function writeEnv(values) {
  const order = [
    "SUPABASE_PROJECT_REF", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY", "ADMIN_USER_ID", "SUPABASE_TEST_USER_A_ID", "SUPABASE_TEST_USER_A_EMAIL",
    "SUPABASE_TEST_USER_A_PASSWORD", "SUPABASE_TEST_USER_B_ID", "SUPABASE_TEST_USER_B_EMAIL",
    "SUPABASE_TEST_USER_B_PASSWORD", "SUPABASE_TEST_ADMIN_ID", "SUPABASE_TEST_ADMIN_EMAIL",
    "SUPABASE_TEST_ADMIN_PASSWORD"
  ];
  fs.writeFileSync(envPath, `${order.filter((key) => values[key] !== undefined).map((key) => `${key}=${values[key]}`).join("\n")}\n`, { mode: 0o600 });
}

async function main() {
  const env = readEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  });
  const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const definitions = [
    ["USER_A", `myassist-phase25-a-${runId}@example.com`],
    ["USER_B", `myassist-phase25-b-${runId}@example.com`],
    ["ADMIN", `myassist-phase25-admin-${runId}@example.com`]
  ];

  for (const [label, defaultEmail] of definitions) {
    const idKey = `SUPABASE_TEST_${label}_ID`;
    if (env[idKey]) continue;
    const emailKey = `SUPABASE_TEST_${label}_EMAIL`;
    const passwordKey = `SUPABASE_TEST_${label}_PASSWORD`;
    const email = env[emailKey] || defaultEmail;
    const password = env[passwordKey] || randomPassword();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error || new Error(`Failed to create ${label}`);
    env[idKey] = data.user.id;
    env[emailKey] = email;
    env[passwordKey] = password;
  }
  env.ADMIN_USER_ID = env.SUPABASE_TEST_ADMIN_ID;
  writeEnv(env);
  console.log("Provisioned 3 isolated Supabase Auth test accounts; credentials remain in the ignored local env file.");
}

main().catch((error) => {
  console.error(`Test account provisioning failed: ${error.message}`);
  process.exit(1);
});
