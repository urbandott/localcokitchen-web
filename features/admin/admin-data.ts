import { createClient } from "@/lib/supabase/server";
import type { AdminCookSummary, AdminMetrics } from "@/types/database";

export async function getAdminMetrics(): Promise<{
  metrics: AdminMetrics | null;
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase) return { metrics: null, error: "Supabase is not configured." };
  const { data, error } = await supabase.schema("lck_identity").rpc("get_admin_metrics");
  return error
    ? { metrics: null, error: "Admin metrics could not be loaded." }
    : { metrics: data, error: null };
}

export async function listAdminCooks(): Promise<{
  cooks: AdminCookSummary[];
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase) return { cooks: [], error: "Supabase is not configured." };
  const { data, error } = await supabase.schema("lck_identity").rpc("list_admin_cooks", {
    p_search: null,
    p_status: "all",
    p_kitchen_state: "all",
    p_sort: "recent",
    p_limit: 50,
    p_offset: 0,
  });
  return error
    ? { cooks: [], error: "Admin cooks could not be loaded." }
    : { cooks: data ?? [], error: null };
}
