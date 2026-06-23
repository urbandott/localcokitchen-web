import { getPublicEnv, hasSupabasePublicEnv } from "@/lib/env";

export function getSupabaseBrowserConfig() {
  const env = getPublicEnv();
  if (!hasSupabasePublicEnv(env)) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
