export const runtime = "nodejs";

export async function GET() {
  if (process.env.DATA_BACKEND === "supabase") {
    return Response.json({ error: "Local SQLite backup export is unavailable in Supabase mode." }, { status: 409 });
  }
  const { exportBackup } = await import("@/lib/db");
  const backup = exportBackup();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="leo-life-study-backup-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
