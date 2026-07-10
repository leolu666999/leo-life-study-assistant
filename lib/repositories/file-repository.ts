import type { ImportantFile } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type ImportantFileInput = Partial<Omit<ImportantFile, "tags">> & { tags?: string[] | string };
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
  listImportantFiles(context?: RepositoryContext): ImportantFile[];
  createImportantFile(input: ImportantFileInput, context?: RepositoryContext): ImportantFile;
  updateImportantFile(id: string, input: ImportantFileInput, context?: RepositoryContext): ImportantFile | null;
  deleteImportantFile(id: string, context?: RepositoryContext): number;
}
