import { createJournal, listJournal } from "@/lib/db";
import type { JournalRepository } from "../journal-repository";

export const sqliteJournalRepository: JournalRepository = {
  listJournal,
  createJournal
};
