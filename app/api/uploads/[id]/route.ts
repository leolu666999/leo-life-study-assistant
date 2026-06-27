import fs from "node:fs/promises";
import path from "node:path";
import { getUploadedFile, uploadsDir } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = getUploadedFile(id);
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  const storedName = String(file.storedName);
  const absolutePath = path.join(uploadsDir, storedName);
  const data = await fs.readFile(absolutePath);

  return new Response(data, {
    headers: {
      "content-type": String(file.mimeType || "application/octet-stream"),
      "cache-control": "private, max-age=3600"
    }
  });
}
