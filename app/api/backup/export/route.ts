import { exportBackup } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const backup = exportBackup();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="leo-life-study-backup-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
