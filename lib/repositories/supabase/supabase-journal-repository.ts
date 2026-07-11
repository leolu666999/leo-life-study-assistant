import { randomUUID } from "node:crypto";
import type { JournalEntry } from "@/lib/types";
import type { JournalRepository } from "../journal-repository";
import { requireSupabaseContext } from "../request-context";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function mapJournal(row: Record<string, unknown>): JournalEntry {
  return {
    id: String(row.id), date: String(row.date), source: row.source as JournalEntry["source"], content: String(row.content),
    linkedPlanId: row.linkedPlanId ? String(row.linkedPlanId) : null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

export const supabaseJournalRepository: JournalRepository = {
  async listJournal(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("journal_entries").select("*").eq("user_id", userId)
      .order("date", { ascending: false }).order("createdAt", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapJournal);
  },
  async createJournal(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const id = randomUUID();
    const { data, error } = await client.from("journal_entries").insert({ id, user_id: userId, date: input.date ?? today(),
      source: input.source ?? "manual", content: input.content ?? "", linkedPlanId: input.linkedPlanId ?? null }).select("*").single();
    if (error) throw error;
    return mapJournal(data);
  }
};
