import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createUploadedFile, uploadsDir } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  const extension = path.extname(file.name);
  const storedName = `${randomUUID()}${extension}`;
  const relativePath = `./uploads/${storedName}`;
  const absolutePath = path.join(uploadsDir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  const metadata = createUploadedFile({
    originalName: file.name,
    storedName,
    path: relativePath,
    mimeType: file.type || "application/octet-stream",
    size: buffer.byteLength,
    linkedEntityType: String(form.get("linkedEntityType") ?? "") || null,
    linkedEntityId: String(form.get("linkedEntityId") ?? "") || null
  });

  return Response.json(metadata, { status: 201 });
}
