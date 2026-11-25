import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "./config";
// Only call after explicit authorization. Never use for ordinary content queries.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(publicConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
