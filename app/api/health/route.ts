import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const appName = "MyAssist";
  const dataBackend = process.env.DATA_BACKEND?.trim() || "sqlite";
  try {
    if (dataBackend === "supabase") {
      return NextResponse.json({ ok: true, app: appName, database: "supabase", dataBackend, time: new Date().toISOString() }, {
        headers: { "cache-control": "private, no-store" }
      });
    }
    const [{ dbPath, getDb }, { appLogDir, dataDir, defaultPort, uploadsDir }] = await Promise.all([
      import("@/lib/db"), import("@/lib/app-config")
    ]);
    getDb().prepare("SELECT 1 AS ok").get();
    return NextResponse.json({
      ok: true,
      app: appName,
      database: "ok",
      databasePath: dbPath,
      dataDir,
      uploadsDir,
      logDir: appLogDir,
      port: defaultPort,
      time: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        app: appName,
        database: "error",
        error: error instanceof Error ? error.message : "Unknown health check error",
        time: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
