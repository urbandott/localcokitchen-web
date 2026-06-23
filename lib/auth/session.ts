import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/safe-path";

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function requireUser(next = "/profile") {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(safeRedirectPath(next))}`);
  return user;
}

export async function currentUserIsAdmin() {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data, error } = await supabase.schema("lck_identity").rpc("current_user_is_admin");
  return !error && data === true;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!(await currentUserIsAdmin())) redirect("/admin/signin");
  return user;
}
