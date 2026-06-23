"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export function createClient() {
  const config = getSupabaseBrowserConfig();
  if (!config) return null;
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
