import type { ImportantFile, SecureDocument } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export type ImportantFileInput = Partial<Omit<ImportantFile, "tags">> & { tags?: string[] | string };
export type SecureDocumentInput = Partial<Omit<SecureDocument, "tags">> & { tags?: string[] | string };
export type UploadedFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
};
export type UploadInput = {
  originalName: string;
  mimeType: string;
  data: Buffer;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
};

export interface FileRepository {
  saveUpload(input: UploadInput, context?: RepositoryContext): Promise<UploadedFileRecord>;
  readUpload(id: string, context?: RepositoryContext): Promise<{ data: Buffer; metadata: UploadedFileRecord } | null>;
  createSignedDownloadUrl(id: string, expiresIn?: number, context?: RepositoryContext): Promise<{ url: string; expiresIn: number } | null>;
  listImportantFiles(context?: RepositoryContext): RepositoryResult<ImportantFile[]>;
  createImportantFile(input: ImportantFileInput, context?: RepositoryContext): RepositoryResult<ImportantFile>;
  updateImportantFile(id: string, input: ImportantFileInput, context?: RepositoryContext): RepositoryResult<ImportantFile | null>;
  deleteImportantFile(id: string, context?: RepositoryContext): RepositoryResult<number>;
  listSecureDocuments(context?: RepositoryContext): RepositoryResult<SecureDocument[]>;
  createSecureDocument(input: SecureDocumentInput, context?: RepositoryContext): RepositoryResult<SecureDocument>;
  updateSecureDocument(id: string, input: SecureDocumentInput, context?: RepositoryContext): RepositoryResult<SecureDocument | null>;
  deleteSecureDocument(id: string, context?: RepositoryContext): RepositoryResult<number>;
}
