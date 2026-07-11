import type { JournalEntry } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export interface JournalRepository {
  listJournal(context?: RepositoryContext): RepositoryResult<JournalEntry[]>;
  createJournal(input: Partial<JournalEntry>, context?: RepositoryContext): RepositoryResult<JournalEntry>;
}
