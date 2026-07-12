import { describe, expect, it } from "vitest";
import { CLOUD_UPLOAD_MAX_BYTES, VERCEL_UPLOAD_MAX_BYTES, cloudUploadBucket, cloudUploadLimit, sanitizeStorageName, validateCloudUpload } from "@/lib/storage/file-security";

const pdf = Buffer.from("%PDF-1.4\nsynthetic phase 6\n%%EOF", "ascii");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("cloud file validation", () => {
  it("accepts a matching PDF and calculates a stable SHA-256", () => {
    const result = validateCloudUpload({ originalName: "receipt.pdf", mimeType: "application/pdf", data: pdf });
    expect(result.extension).toBe(".pdf");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateCloudUpload({ originalName: "other.pdf", mimeType: "application/pdf", data: pdf }).sha256).toBe(result.sha256);
  });

  it("accepts a matching PNG", () => {
    expect(validateCloudUpload({ originalName: "image.png", mimeType: "image/png", data: png }).mimeType).toBe("image/png");
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateCloudUpload({ originalName: "x.pdf", mimeType: "application/pdf", data: Buffer.alloc(0) })).toThrow("empty");
    expect(() => validateCloudUpload({ originalName: "x.pdf", mimeType: "application/pdf", data: Buffer.alloc(CLOUD_UPLOAD_MAX_BYTES + 1) })).toThrow("10 MB");
  });

  it("rejects unsupported MIME, mismatched extension, and mismatched magic bytes", () => {
    expect(() => validateCloudUpload({ originalName: "x.html", mimeType: "text/html", data: Buffer.from("<html>") })).toThrow("not allowed");
    expect(() => validateCloudUpload({ originalName: "x.png", mimeType: "application/pdf", data: pdf })).toThrow("extension");
    expect(() => validateCloudUpload({ originalName: "x.pdf", mimeType: "application/pdf", data: Buffer.from("not pdf") })).toThrow("content");
  });

  it("rejects traversal names and sanitizes safe object names", () => {
    for (const name of ["../x.pdf", "folder/x.pdf", "folder\\x.pdf"]) {
      expect(() => validateCloudUpload({ originalName: name, mimeType: "application/pdf", data: pdf })).toThrow("Unsafe");
    }
    expect(sanitizeStorageName("学校 收据 (1).PDF", ".pdf")).toBe("1.pdf");
  });

  it("selects only the two approved buckets from server-controlled purpose", () => {
    expect(cloudUploadBucket("expense")).toBe("receipts");
    expect(cloudUploadBucket("important_file")).toBe("important-files");
    expect(cloudUploadBucket("../../other")).toBe("important-files");
  });

  it("keeps the 10 MiB Cloud limit locally and caps Vercel multipart at 4 MiB", () => {
    expect(cloudUploadLimit({})).toBe(CLOUD_UPLOAD_MAX_BYTES);
    expect(cloudUploadLimit({ VERCEL: "1" })).toBe(VERCEL_UPLOAD_MAX_BYTES);
    expect(cloudUploadLimit({ VERCEL_ENV: "preview" })).toBe(VERCEL_UPLOAD_MAX_BYTES);
  });
});
