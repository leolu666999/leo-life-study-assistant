import { getJournalRepository } from "@/lib/repositories";
import type { RepositoryContext } from "@/lib/repositories/repository-context";
import type { JournalEntry } from "@/lib/types";

export class JournalService {
  constructor(private readonly repository = getJournalRepository()) {}

  listJournal(context?: RepositoryContext) {
    return this.repository.listJournal(context);
  }

  createJournal(input: Partial<JournalEntry>, context?: RepositoryContext) {
    return this.repository.createJournal(input, context);
  }
}

export function getJournalService() {
  return new JournalService();
}
