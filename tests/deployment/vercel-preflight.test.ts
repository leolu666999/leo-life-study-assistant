import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";

const originalBackend = process.env.DATA_BACKEND;

afterEach(() => {
  if (originalBackend === undefined) delete process.env.DATA_BACKEND;
  else process.env.DATA_BACKEND = originalBackend;
});

describe("Vercel Cloud-only utility routes", () => {
  it("runs server functions beside the Sydney Supabase project", () => {
    const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
    expect(config.regions).toEqual(["syd1"]);
  });

  it("excludes every local data and generated directory from CLI deployment", () => {
    const ignored = fs.readFileSync(".vercelignore", "utf8");
    for (const entry of ["/node_modules/", "/.next/", "/data/", "/uploads/", ".env*", "/migration-reports/", "/supabase/.temp/"]) {
      expect(ignored).toContain(entry);
    }
    expect(ignored).not.toMatch(/^uploads\/$/m);
    expect(ignored).not.toMatch(/^data\/$/m);
    expect(fs.existsSync("app/api/uploads/[id]/route.ts")).toBe(true);
    expect(fs.existsSync("app/api/admin/users/[userId]/data/route.ts")).toBe(true);
  });

  it("health reports Supabase without local filesystem paths", async () => {
    process.env.DATA_BACKEND = "supabase";
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, app: "MyAssist", database: "supabase", dataBackend: "supabase" });
    expect(body).not.toHaveProperty("databasePath");
    expect(body).not.toHaveProperty("uploadsDir");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("backup refuses Cloud mode before loading the SQLite exporter", async () => {
    process.env.DATA_BACKEND = "supabase";
    const { GET } = await import("@/app/api/backup/export/route");
    const response = await GET();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Local SQLite backup export is unavailable in Supabase mode." });
  });

  it("network returns the public request origin instead of a local interface", async () => {
    process.env.DATA_BACKEND = "supabase";
    const { GET } = await import("@/app/api/network/route");
    const response = await GET(new Request("https://myassist-preview.vercel.app/api/network"));
    expect(await response.json()).toEqual({ port: "", ip: "", url: "https://myassist-preview.vercel.app" });
  });

  it("events ends with 204 in Cloud mode instead of opening process-local SSE", async () => {
    process.env.DATA_BACKEND = "supabase";
    const { GET } = await import("@/app/api/events/route");
    const response = await GET();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
