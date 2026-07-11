import { NextResponse } from "next/server";
import { dbPath, getDb } from "@/lib/db";
import { appLogDir, appName, dataBackend, dataDir, defaultPort, uploadsDir } from "@/lib/app-config";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (dataBackend === "supabase") {
      return NextResponse.json({ ok: true, app: appName, database: "supabase", dataBackend, port: defaultPort, time: new Date().toISOString() });
    }
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
