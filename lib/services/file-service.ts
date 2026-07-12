import { getFileRepository } from "@/lib/repositories";
import type { ImportantFileInput, UploadInput } from "@/lib/repositories/file-repository";
import type { RepositoryContext } from "@/lib/repositories/repository-context";

export class FileService {
  constructor(private readonly repository = getFileRepository()) {}

  saveUpload(input: UploadInput, context?: RepositoryContext) {
    return this.repository.saveUpload(input, context);
  }

  readUpload(id: string, context?: RepositoryContext) {
    return this.repository.readUpload(id, context);
  }

  createSignedDownloadUrl(id: string, expiresIn: number, context?: RepositoryContext) {
    return this.repository.createSignedDownloadUrl(id, expiresIn, context);
  }

  listImportantFiles(context?: RepositoryContext) {
    return this.repository.listImportantFiles(context);
  }

  createImportantFile(input: ImportantFileInput, context?: RepositoryContext) {
    return this.repository.createImportantFile(input, context);
  }

  updateImportantFile(id: string, input: ImportantFileInput, context?: RepositoryContext) {
    return this.repository.updateImportantFile(id, input, context);
  }

  deleteImportantFile(id: string, context?: RepositoryContext) {
    return this.repository.deleteImportantFile(id, context);
  }
}

export function getFileService() {
  return new FileService();
}
