import { createHash } from "node:crypto";
import path from "node:path";

export const CLOUD_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const VERCEL_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export function cloudUploadLimit(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL === "1" || env.VERCEL_ENV ? VERCEL_UPLOAD_MAX_BYTES : CLOUD_UPLOAD_MAX_BYTES;
}

const TYPES = {
  "application/pdf": { extensions: [".pdf"], signature: (data: Buffer) => data.subarray(0, 5).toString("ascii") === "%PDF-" },
  "image/jpeg": { extensions: [".jpg", ".jpeg"], signature: (data: Buffer) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extensions: [".png"], signature: (data: Buffer) => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extensions: [".webp"], signature: (data: Buffer) => data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP" }
} as const;

export type AllowedCloudMime = keyof typeof TYPES;

export function validateCloudUpload(input: { originalName: string; mimeType: string; data: Buffer }) {
  if (input.data.byteLength <= 0) throw new Error("File is empty");
  if (input.data.byteLength > CLOUD_UPLOAD_MAX_BYTES) throw new Error("File exceeds the 10 MB cloud upload limit");
  if (!input.originalName || input.originalName.includes("/") || input.originalName.includes("\\") || input.originalName.includes("..")) {
    throw new Error("Unsafe file name");
  }
  const mimeType = input.mimeType.toLowerCase() as AllowedCloudMime;
  const rule = TYPES[mimeType];
  if (!rule) throw new Error("File type is not allowed");
  const extension = path.extname(input.originalName).toLowerCase();
  if (!(rule.extensions as readonly string[]).includes(extension)) throw new Error("File extension does not match its MIME type");
  if (!rule.signature(input.data)) throw new Error("File content does not match its MIME type");
  return { mimeType, extension, sha256: createHash("sha256").update(input.data).digest("hex") };
}

export function sanitizeStorageName(originalName: string, extension: string) {
  const stem = path.basename(originalName, path.extname(originalName)).normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 80) || "file";
  return `${stem}${extension}`;
}

export function cloudUploadBucket(linkedEntityType?: string | null) {
  return linkedEntityType === "expense" ? "receipts" : "important-files";
}
