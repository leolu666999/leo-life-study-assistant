import type { JournalEntry } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export interface JournalRepository {
  listJournal(context?: RepositoryContext): JournalEntry[];
  createJournal(input: Partial<JournalEntry>, context?: RepositoryContext): JournalEntry;
}
