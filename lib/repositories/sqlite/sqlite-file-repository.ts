import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createImportantFile,
  createSecureDocument,
  createUploadedFile,
  deleteImportantFile,
  deleteSecureDocument,
  getUploadedFile,
  listImportantFiles,
  listSecureDocuments,
  updateImportantFile,
  updateSecureDocument,
  uploadsDir
} from "@/lib/db";
import type { FileRepository, UploadedFileRecord } from "../file-repository";

function asUploadedFileRecord(value: Record<string, unknown>) {
  return {
    id: String(value.id),
    originalName: String(value.originalName),
    storedName: String(value.storedName),
    path: String(value.path),
    mimeType: String(value.mimeType),
    size: Number(value.size),
    createdAt: String(value.createdAt),
    linkedEntityType: value.linkedEntityType ? String(value.linkedEntityType) : null,
    linkedEntityId: value.linkedEntityId ? String(value.linkedEntityId) : null
  } satisfies UploadedFileRecord;
}

export const sqliteFileRepository: FileRepository = {
  async saveUpload(input) {
    await fs.mkdir(uploadsDir, { recursive: true });
    const extension = path.extname(input.originalName);
    const storedName = `${randomUUID()}${extension}`;
    await fs.writeFile(path.join(uploadsDir, storedName), input.data);
    const metadata = createUploadedFile({
      originalName: input.originalName,
      storedName,
      path: `./uploads/${storedName}`,
      mimeType: input.mimeType || "application/octet-stream",
      size: input.data.byteLength,
      linkedEntityType: input.linkedEntityType ?? null,
      linkedEntityId: input.linkedEntityId ?? null
    });
    if (!metadata) throw new Error("Uploaded file metadata was not created");
    return asUploadedFileRecord(metadata);
  },

  async readUpload(id) {
    const file = getUploadedFile(id);
    if (!file) return null;
    const metadata = asUploadedFileRecord(file);
    const data = await fs.readFile(path.join(uploadsDir, metadata.storedName));
    return { data, metadata };
  },

  async createSignedDownloadUrl() {
    return null;
  },

  listImportantFiles,
  createImportantFile,
  updateImportantFile,
  deleteImportantFile,
  listSecureDocuments,
  createSecureDocument,
  updateSecureDocument,
  deleteSecureDocument
};
