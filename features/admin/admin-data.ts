import { createClient } from "@/lib/supabase/server";
import type {
  AdminCookSummary,
  AdminMetrics,
  CookApplication,
  CookProfile,
  CustomerOrder,
  CustomerOrderItem,
  CustomerPaymentAttempt,
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

export type AdminOrderItemSummary = Pick<
  CustomerOrderItem,
  | "cook_id"
  | "fulfillment_status"
  | "fulfilled_at"
  | "id"
  | "item_name"
  | "line_total_cents"
  | "quantity"
  | "unit_price_cents"
> & {
  cookDisplayName: string | null;
};

export type AdminOrderSummary = CustomerOrder & {
  customer: Pick<IdentityUser, "email" | "first_name" | "full_name" | "id" | "last_name"> | null;
  items: AdminOrderItemSummary[];
  latestPayment: Pick<
    CustomerPaymentAttempt,
    "amount_cents" | "created_at" | "currency" | "provider" | "status" | "updated_at"
  > | null;
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

function displayName(
  profile: Pick<CookProfile, "display_name"> | null | undefined,
  user: Pick<IdentityUser, "email" | "first_name" | "full_name" | "last_name"> | null | undefined,
): string | null {
  if (profile?.display_name) return profile.display_name;
  if (user?.full_name) return user.full_name;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return name || user?.email || null;
}

export async function listAdminOrders(): Promise<{
  error: string | null;
  orders: AdminOrderSummary[];
}> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured.", orders: [] };

  const marketplace = supabase.schema("lck_marketplace");
  const { data: orders, error } = await marketplace
    .from("customer_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(75);

  if (error) return { error: "Admin orders could not be loaded.", orders: [] };
  if (!orders?.length) return { error: null, orders: [] };

  const orderIds = orders.map((order) => order.id);
  const customerIds = [...new Set(orders.map((order) => order.customer_id))];

  const [itemsResult, paymentsResult, customersResult] = await Promise.all([
    marketplace
      .from("customer_order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),
    marketplace
      .from("customer_payment_attempts")
      .select("amount_cents,created_at,currency,order_id,provider,status,updated_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    supabase
      .schema("lck_identity")
      .from("users")
      .select("id,email,first_name,last_name,full_name")
      .in("id", customerIds),
  ]);

  if (itemsResult.error || paymentsResult.error || customersResult.error) {
    return { error: "Admin order details could not be loaded.", orders: [] };
  }

  const items = itemsResult.data ?? [];
  const cookIds = [...new Set(items.map((item) => item.cook_id))];
  const [cookProfilesResult, cookUsersResult] =
    cookIds.length > 0
      ? await Promise.all([
          marketplace.from("cook_profiles").select("cook_id,display_name").in("cook_id", cookIds),
          supabase
            .schema("lck_identity")
            .from("users")
            .select("id,email,first_name,last_name,full_name")
            .in("id", cookIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (cookProfilesResult.error || cookUsersResult.error) {
    return { error: "Admin cook context could not be loaded.", orders: [] };
  }

  const customersById = new Map((customersResult.data ?? []).map((user) => [user.id, user]));
  const cookProfilesById = new Map(
    (cookProfilesResult.data ?? []).map((profile) => [profile.cook_id, profile]),
  );
  const cookUsersById = new Map((cookUsersResult.data ?? []).map((user) => [user.id, user]));
  const itemsByOrder = new Map<string, CustomerOrderItem[]>();
  for (const item of items) {
    const current = itemsByOrder.get(item.order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.order_id, current);
  }
  const paymentsByOrder = new Map<string, typeof paymentsResult.data>();
  for (const payment of paymentsResult.data ?? []) {
    const current = paymentsByOrder.get(payment.order_id) ?? [];
    current.push(payment);
    paymentsByOrder.set(payment.order_id, current);
  }

  return {
    error: null,
    orders: orders.map((order) => ({
      ...order,
      customer: customersById.get(order.customer_id) ?? null,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        cook_id: item.cook_id,
        cookDisplayName: displayName(
          cookProfilesById.get(item.cook_id),
          cookUsersById.get(item.cook_id),
        ),
        fulfilled_at: item.fulfilled_at,
        fulfillment_status: item.fulfillment_status,
        id: item.id,
        item_name: item.item_name,
        line_total_cents: item.line_total_cents,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      })),
      latestPayment: paymentsByOrder.get(order.id)?.[0] ?? null,
    })),
  };
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
