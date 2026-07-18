import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Phase 7 production account and contact contracts", () => {
  const migration = read("supabase/migrations/202607120006_phase7_accounts_messages.sql");

  it("adds a case-insensitive unique username with a constrained format", () => {
    expect(migration).toContain("add column if not exists username text");
    expect(migration).toContain("unique index if not exists profiles_username_unique");
    expect(migration).toContain("lower(username)");
    expect(migration).toContain("^[A-Za-z0-9_]{3,24}$");
  });

  it("creates a service-only developer message table with required states", () => {
    expect(migration).toContain("create table if not exists public.developer_messages");
    expect(migration).toContain("('unread', 'read', 'resolved')");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on table public.developer_messages from public, anon, authenticated");
  });

  it("keeps username resolution and contact identity enrichment on the server", () => {
    const login = read("app/api/auth/login/route.ts");
    const contact = read("app/api/developer-contact/route.ts");
    expect(login).toContain('from("profiles")');
    expect(login).toContain("createSupabaseAdminClient");
    expect(login).toContain("rememberMe");
    expect(login).toContain("myassist_session_only");
    expect(contact).toContain("authenticatedRequestUser");
    expect(contact).not.toContain("user_id: body");
  });

  it("supports visible password controls and protected private image previews", () => {
    const authForm = read("components/auth/auth-form.tsx");
    const app = read("components/leo-app.tsx");
    const middleware = read("middleware.ts");
    expect(authForm).toContain("显示密码");
    expect(authForm).toContain("在这台电脑保持登录");
    expect(authForm).toContain("3 至 24 位，仅限英文字母、数字和下划线");
    expect(authForm).toContain("用户名全局唯一，且不区分大小写");
    expect(authForm).toContain("至少 8 个字符，密码区分大小写");
    expect(authForm).toContain("密码区分大小写，请输入注册时设置的完整密码");
    expect(authForm).toContain("data.user.identities.length === 0");
    expect(authForm).toContain('error.code === "user_already_exists"');
    expect(authForm).toContain('errorText.includes("email already registered")');
    expect(authForm).toContain("该邮箱已被使用，请直接登录或使用“找回密码”");
    expect(authForm).toContain("每个邮箱只能注册一个账号");
    expect(app).toContain("/api/private-files/");
    const privateFiles = read("app/api/private-files/[id]/route.ts");
    expect(privateFiles).toContain('from "../../uploads/[id]/route"');
    expect(privateFiles).toContain('dynamic = "force-dynamic"');
    expect(privateFiles).toContain('fetchCache = "force-no-store"');
    expect(app).toContain("function UploadImage");
    expect(middleware).toContain('"cache-control", "private, no-store, max-age=0"');
    expect(middleware).toContain('"vary", "Cookie, Authorization"');
  });

  it("protects admin pages and all elevated routes", () => {
    expect(read("app/admin/page.tsx")).toContain("isAdmin(user)");
    for (const file of [
      "app/api/admin/users/route.ts", "app/api/admin/users/[userId]/route.ts",
      "app/api/admin/messages/route.ts", "app/api/admin/messages/[messageId]/route.ts",
      "app/api/admin/users/[userId]/files/[fileId]/signed-url/route.ts"
    ]) expect(read(file)).toContain("assertAdminRequest(request)");
  });

  it("uses short-lived signed URLs and audits message state changes", () => {
    expect(read("app/api/admin/users/[userId]/files/[fileId]/signed-url/route.ts")).toContain("createSignedUrl(file.object_path, 60");
    expect(read("app/api/admin/messages/[messageId]/route.ts")).toContain("writeAdminAudit");
  });

  it("renders the finance modal with segmented mode, amount focus and category chips", () => {
    const source = read("components/leo-app.tsx");
    expect(source).toContain('placeholder="0.00"');
    expect(source).toContain("rounded-full bg-slate-100 p-1");
    expect(source).toContain("上传凭证、小票或账单图片");
    expect(source).toContain("flex flex-wrap gap-2");
  });

  it("keeps completed and archived task cards out of the dashboard", () => {
    const source = read("components/leo-app.tsx");
    expect(source).toContain('tasks.filter((task) => task.status !== "completed" && task.status !== "archived")');
    expect(source).not.toContain('archiveTasks.filter((task) => task.status === "completed")');
    expect(source).toContain('statusFilter === "completed" && isCompletedGroup');
  });

  it("defaults login to Chinese and keeps bilingual landing product terms stable", () => {
    const login = read("components/auth/login-page-client.tsx");
    const landing = read("components/landing-page.tsx");
    expect(login).toContain('useState<UiLanguage>("zh-CN")');
    expect(login).toContain('setLanguage("zh-CN")');
    expect(login).not.toContain('saved === "en" ? "en" : "zh-CN"');
    expect(landing).toContain('type LandingLanguage = "zh-CN" | "en"');
    expect(landing).toContain('onClick={() => selectLanguage("zh-CN")}');
    expect(landing).toContain('onClick={() => selectLanguage("en")}');
    expect(landing).toContain("Today’s Schedule");
    expect(landing).toContain("To Do");
    expect(landing).toContain("Task");
  });

  it("renders plans as a searchable single-view workspace with four-column Daily previews", () => {
    const source = read("components/leo-app.tsx");
    expect(source).toContain('useState<PlanType>("daily")');
    expect(source).toContain('(["daily", "weekly", "monthly"] as PlanType[])');
    expect(source).toContain("matchesTodoListSearch");
    expect(source).toContain("matchesPlanSearch");
    expect(source).toContain("xl:grid-cols-4");
    expect(source).toContain("md:hover:overflow-y-auto");
  });
});
