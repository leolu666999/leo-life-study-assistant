import type { SupabaseClient } from "@supabase/supabase-js";

export type RepositoryContext = {
  backend?: "sqlite" | "supabase";
  userId?: string;
  supabase?: SupabaseClient;
};

export type RepositoryResult<T> = T | Promise<T>;
