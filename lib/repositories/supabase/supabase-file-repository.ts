import { randomUUID } from "node:crypto";
import type { ImportantFile, SecureDocument } from "@/lib/types";
import { cloudUploadBucket, sanitizeStorageName, validateCloudUpload } from "@/lib/storage/file-security";
import type { FileRepository, ImportantFileInput, SecureDocumentInput, UploadedFileRecord } from "../file-repository";
import type { RepositoryContext } from "../repository-context";
import { requireSupabaseContext } from "../request-context";

type Row = Record<string, unknown>;
export type CloudPendingDelete = { deleted?: boolean; cleanup?: boolean; fileId?: string; bucket?: string; objectPath?: string };

function uploaded(row: Row): UploadedFileRecord {
  return {
    id: String(row.id), originalName: String(row.originalName), storedName: String(row.storedName),
    path: `/api/uploads/${String(row.id)}`, mimeType: String(row.mimeType), size: Number(row.size), createdAt: String(row.createdAt),
    linkedEntityType: row.linkedEntityType ? String(row.linkedEntityType) : null,
    linkedEntityId: row.linkedEntityId ? String(row.linkedEntityId) : null
  };
}

function tags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value ?? "").split(/[，,\n]/).map((tag) => tag.trim()).filter(Boolean);
}

function important(row: Row, file: Row): ImportantFile {
  return {
    id: String(row.id), title: String(row.title), category: String(row.category), tags: tags(row.tags_json),
    notes: row.notes ? String(row.notes) : null, fileId: String(row.fileId), originalName: String(file.originalName),
    mimeType: String(file.mimeType), size: Number(file.size), expiryDate: row.expiryDate ? String(row.expiryDate) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

function secureDocument(row: Row): SecureDocument {
  return {
    id: String(row.id), title: String(row.title), content: String(row.content ?? ""),
    category: String(row.category ?? "其他"), tags: tags(row.tags_json), notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

function secureDocumentPayload(input: SecureDocumentInput) {
  return {
    title: String(input.title ?? "未命名文档").trim() || "未命名文档",
    content: String(input.content ?? ""),
    category: input.category ?? "其他",
    tags_json: tags(input.tags),
    notes: input.notes ?? null,
    updatedAt: new Date().toISOString()
  };
}

async function uploadRow(id: string, context?: RepositoryContext, requireUploaded = true) {
  const { client, userId } = requireSupabaseContext(context);
  let query = client.from("uploaded_files").select("*").eq("user_id", userId).eq("id", id);
  if (requireUploaded) query = query.eq("status", "uploaded");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

async function importantById(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const { data, error } = await client.from("important_files").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const file = await uploadRow(String(data.fileId), context, false);
  return file ? important(data, file) : null;
}

export async function removePendingCloudObject(result: CloudPendingDelete, context?: RepositoryContext) {
  if (!result.cleanup || !result.fileId || !result.bucket || !result.objectPath) return;
  const { client, userId } = requireSupabaseContext(context);
  if (!result.objectPath.startsWith(`${userId}/`)) throw new Error("Unsafe Storage object ownership");
  const separator = result.objectPath.lastIndexOf("/");
  const directory = result.objectPath.slice(0, separator);
  const objectName = result.objectPath.slice(separator + 1);
  const { data: before, error: beforeError } = await client.storage.from(result.bucket).list(directory, { search: objectName, limit: 10 });
  if (beforeError || !before?.some((item) => item.name === objectName)) {
    throw new Error(`Storage object could not be verified before deletion; upload remains pending_delete${beforeError ? `: ${beforeError.message}` : ""}`);
  }
  const { error: storageError } = await client.storage.from(result.bucket).remove([result.objectPath]);
  if (storageError) throw new Error(`Storage deletion failed; upload remains pending_delete: ${storageError.message}`);
  const { data: remaining, error: verifyError } = await client.storage.from(result.bucket).list(directory, { search: objectName, limit: 10 });
  if (verifyError || remaining?.some((item) => item.name === objectName)) {
    throw new Error(`Storage deletion could not be verified; upload remains pending_delete${verifyError ? `: ${verifyError.message}` : ""}`);
  }
  const { data, error } = await client.from("uploaded_files").update({ status: "deleted", deletedAt: new Date().toISOString() })
    .eq("user_id", userId).eq("id", result.fileId).eq("status", "pending_delete").select("id");
  if (error || data?.length !== 1) throw error || new Error("Storage object was removed but metadata finalization failed");
}

export async function retryPendingCloudObject(fileId: string, context?: RepositoryContext) {
  const { client } = requireSupabaseContext(context);
  const { data, error } = await client.rpc("prepare_pending_file_delete", { p_file_id: fileId });
  if (error) throw error;
  const result = (data ?? {}) as CloudPendingDelete;
  if (!result.cleanup) return false;
  await removePendingCloudObject(result, context);
  return true;
}

export const supabaseFileRepository: FileRepository = {
  async saveUpload(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const validated = validateCloudUpload(input);
    const id = randomUUID();
    const bucket = cloudUploadBucket(input.linkedEntityType);
    const storedName = sanitizeStorageName(input.originalName, validated.extension);
    const objectPath = `${userId}/${id}/${storedName}`;
    const record = {
      id, user_id: userId, originalName: input.originalName, storedName, path: objectPath,
      mimeType: validated.mimeType, size: input.data.byteLength, bucket, object_path: objectPath,
      sha256: validated.sha256, status: "pending", linkedEntityType: null, linkedEntityId: null
    };
    const { error: metadataError } = await client.from("uploaded_files").insert(record);
    if (metadataError) throw metadataError;

    const { error: storageError } = await client.storage.from(bucket).upload(objectPath, input.data, {
      contentType: validated.mimeType, upsert: false, cacheControl: "3600"
    });
    if (storageError) {
      await client.from("uploaded_files").update({ status: "failed" }).eq("user_id", userId).eq("id", id);
      throw storageError;
    }

    const { data, error: finalError } = await client.from("uploaded_files").update({ status: "uploaded" })
      .eq("user_id", userId).eq("id", id).eq("status", "pending").select("*").single();
    if (finalError) {
      const removal = await client.storage.from(bucket).remove([objectPath]);
      const directory = objectPath.slice(0, objectPath.lastIndexOf("/"));
      const verification = await client.storage.from(bucket).list(directory, { search: storedName, limit: 10 });
      const removed = !removal.error && !verification.error && !verification.data?.some((item) => item.name === storedName);
      await client.from("uploaded_files").update({ status: removed ? "deleted" : "failed", deletedAt: removed ? new Date().toISOString() : null })
        .eq("user_id", userId).eq("id", id);
      throw finalError;
    }
    return uploaded(data);
  },

  async readUpload(id, context) {
    const row = await uploadRow(id, context);
    if (!row?.bucket || !row.object_path) return null;
    const { client } = requireSupabaseContext(context);
    const { data, error } = await client.storage.from(String(row.bucket)).download(String(row.object_path));
    if (error) throw error;
    return { data: Buffer.from(await data.arrayBuffer()), metadata: uploaded(row) };
  },

  async createSignedDownloadUrl(id, expiresIn = 60, context) {
    const row = await uploadRow(id, context);
    if (!row?.bucket || !row.object_path) return null;
    const ttl = Math.max(1, Math.min(300, Math.floor(expiresIn)));
    const { client } = requireSupabaseContext(context);
    const { data, error } = await client.storage.from(String(row.bucket)).createSignedUrl(String(row.object_path), ttl);
    if (error) throw error;
    return { url: data.signedUrl, expiresIn: ttl };
  },

  async listImportantFiles(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("important_files").select("*").eq("user_id", userId).order("createdAt", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ids = [...new Set(rows.map((row) => String(row.fileId)))];
    if (ids.length === 0) return [];
    const { data: files, error: fileError } = await client.from("uploaded_files").select("*").eq("user_id", userId).in("id", ids).eq("status", "uploaded");
    if (fileError) throw fileError;
    const byId = new Map((files ?? []).map((row) => [String(row.id), row as Row]));
    return rows.flatMap((row) => {
      const file = byId.get(String(row.fileId));
      return file ? [important(row, file)] : [];
    });
  },

  async createImportantFile(input, context) {
    const { client } = requireSupabaseContext(context);
    const id = randomUUID();
    const payload = { title: input.title ?? "未命名文件", category: input.category ?? "其他", tags: tags(input.tags),
      notes: input.notes ?? null, expiryDate: input.expiryDate ?? null, fileId: input.fileId };
    const { error } = await client.rpc("save_important_file", { p_important_id: id, p_input: payload });
    if (error) throw error;
    return (await importantById(id, context))!;
  },

  async updateImportantFile(id, input, context) {
    const { client } = requireSupabaseContext(context);
    const current = await importantById(id, context);
    if (!current) return null;
    const payload: ImportantFileInput = { ...current, ...input, fileId: current.fileId, tags: input.tags === undefined ? current.tags : tags(input.tags) };
    const { error } = await client.rpc("save_important_file", { p_important_id: id, p_input: payload });
    if (error) throw error;
    return importantById(id, context);
  },

  async deleteImportantFile(id, context) {
    const { client } = requireSupabaseContext(context);
    const { data, error } = await client.rpc("detach_important_file_for_delete", { p_important_id: id });
    if (error) throw error;
    const result = (data ?? {}) as CloudPendingDelete;
    if (!result.deleted) return 0;
    await removePendingCloudObject(result, context);
    return 1;
  },

  async listSecureDocuments(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("secure_documents").select("*").eq("user_id", userId).order("updatedAt", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => secureDocument(row as Row));
  },

  async createSecureDocument(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const id = randomUUID();
    const { data, error } = await client.from("secure_documents")
      .insert({ id, user_id: userId, ...secureDocumentPayload(input) }).select("*").single();
    if (error) throw error;
    return secureDocument(data as Row);
  },

  async updateSecureDocument(id, input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data: current, error: currentError } = await client.from("secure_documents").select("*")
      .eq("user_id", userId).eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return null;
    const payload = secureDocumentPayload({
      ...secureDocument(current as Row),
      ...input,
      tags: input.tags === undefined ? tags(current.tags_json) : input.tags
    });
    const { data, error } = await client.from("secure_documents").update(payload)
      .eq("user_id", userId).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? secureDocument(data as Row) : null;
  },

  async deleteSecureDocument(id, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("secure_documents").delete()
      .eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }
};
