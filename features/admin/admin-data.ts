import { createClient } from "@/lib/supabase/server";
import type {
  AdminCookSummary,
  AdminMetrics,
  CookApplication,
  IdentityUser,
} from "@/types/database";

export type AdminCookApplicationDocument = {
  label: string;
  signedUrl: string | null;
};

export type AdminCookApplicationReview = {
  application: CookApplication;
  user: Pick<IdentityUser, "id" | "email" | "first_name" | "last_name" | "full_name"> | null;
  documents: AdminCookApplicationDocument[];
};

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

function safeOwnerDocumentPath(path: string | null, userId: string): string | null {
  if (!path) return null;
  if (!path.startsWith(`${userId}/`)) return null;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return null;
  return path;
}

async function signedDocumentUrl(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  label: string,
  path: string | null,
  userId: string,
): Promise<AdminCookApplicationDocument> {
  const safePath = safeOwnerDocumentPath(path, userId);
  if (!safePath) return { label, signedUrl: null };

  const { data, error } = await supabase.storage
    .from("cook-documents")
    .createSignedUrl(safePath, 300);

  return { label, signedUrl: error ? null : data.signedUrl };
}

export async function listSubmittedCookApplicationsForReview(): Promise<{
  applications: AdminCookApplicationReview[];
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase) return { applications: [], error: "Supabase is not configured." };

  const marketplace = supabase.schema("lck_marketplace");
  const applications = await marketplace
    .from("cook_applications")
    .select("*")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(50);

  if (applications.error) {
    return { applications: [], error: "Submitted cook applications could not be loaded." };
  }

  const rows = applications.data ?? [];
  if (rows.length === 0) return { applications: [], error: null };

  const userIds = rows.map((application) => application.user_id);
  const users = await supabase
    .schema("lck_identity")
    .from("users")
    .select("id,email,first_name,last_name,full_name")
    .in("id", userIds);

  if (users.error) {
    return { applications: [], error: "Application applicant profiles could not be loaded." };
  }

  const usersById = new Map((users.data ?? []).map((user) => [user.id, user]));
  const reviewed = await Promise.all(
    rows.map(async (application) => ({
      application,
      user: usersById.get(application.user_id) ?? null,
      documents: await Promise.all([
        signedDocumentUrl(
          supabase,
          "Food handler certificate",
          application.food_handler_certificate_url,
          application.user_id,
        ),
        signedDocumentUrl(
          supabase,
          "Government ID",
          application.government_id_document_url,
          application.user_id,
        ),
        signedDocumentUrl(
          supabase,
          "Selfie verification",
          application.selfie_verification_url,
          application.user_id,
        ),
        signedDocumentUrl(
          supabase,
          "Additional permit or certification",
          application.permit_or_certification_url,
          application.user_id,
        ),
      ]),
    })),
  );

  return { applications: reviewed, error: null };
}
