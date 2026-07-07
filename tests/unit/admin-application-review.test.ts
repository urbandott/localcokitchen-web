import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({
  applicationRows: vi.fn(),
  createClient: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  signedUrl: vi.fn(),
  updateApplication: vi.fn(),
  userRows: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: adminMocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: adminMocks.requireAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: adminMocks.createClient,
}));

import { reviewCookApplicationAction } from "@/features/admin/actions";
import { listSubmittedCookApplicationsForReview } from "@/features/admin/admin-data";

function reviewForm(values: { cookId?: string; decision?: string; reviewNotes?: string }) {
  const formData = new FormData();
  if (values.cookId !== undefined) formData.set("cookId", values.cookId);
  if (values.decision !== undefined) formData.set("decision", values.decision);
  if (values.reviewNotes !== undefined) formData.set("reviewNotes", values.reviewNotes);
  return formData;
}

function mockSupabase() {
  adminMocks.updateApplication.mockImplementation(() => ({
    eq: () => ({
      eq: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: { user_id: "cook-id" }, error: null }),
        }),
      }),
    }),
  }));

  return {
    schema: (schema: string) => ({
      from: (table: string) => {
        if (schema === "lck_marketplace" && table === "cook_applications") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: adminMocks.applicationRows,
                }),
              }),
            }),
            update: adminMocks.updateApplication,
          };
        }

        if (schema === "lck_identity" && table === "users") {
          return {
            select: () => ({
              in: adminMocks.userRows,
            }),
          };
        }

        throw new Error(`Unexpected query ${schema}.${table}`);
      },
    }),
    storage: {
      from: () => ({
        createSignedUrl: adminMocks.signedUrl,
      }),
    },
  };
}

describe("admin application review data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.requireAdmin.mockResolvedValue({ id: "admin-id" });
    adminMocks.createClient.mockResolvedValue(mockSupabase());
    adminMocks.signedUrl.mockImplementation((path: string) =>
      Promise.resolve({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
    );
  });

  it("creates short-lived signed URLs only for owner-scoped private documents", async () => {
    adminMocks.applicationRows.mockResolvedValue({
      data: [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          legal_name: "Asha Cook",
          phone: "+1 312-555-0142",
          pickup_address: "123 Kitchen Lane",
          pickup_zip_code: "60601",
          food_handler_training_completed: true,
          food_handler_certificate_url: "11111111-1111-4111-8111-111111111111/certificate.pdf",
          government_id_document_url: "other-user/government-id.pdf",
          selfie_verification_url: "../selfie.png",
          permit_or_certification_url: null,
          status: "submitted",
          submitted_at: "2026-07-07T00:00:00.000Z",
          reviewed_at: null,
          reviewed_by: null,
          review_notes: null,
          created_at: "2026-07-07T00:00:00.000Z",
          updated_at: "2026-07-07T00:00:00.000Z",
        },
      ],
      error: null,
    });
    adminMocks.userRows.mockResolvedValue({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "asha@example.com",
          first_name: "Asha",
          last_name: "Cook",
          full_name: "Asha Cook",
        },
      ],
      error: null,
    });

    const result = await listSubmittedCookApplicationsForReview();

    expect(result.error).toBeNull();
    expect(result.applications).toHaveLength(1);
    expect(adminMocks.signedUrl).toHaveBeenCalledTimes(1);
    expect(adminMocks.signedUrl).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111/certificate.pdf",
      300,
    );
    expect(result.applications[0]?.documents).toEqual([
      {
        label: "Food handler certificate",
        signedUrl: "https://signed.example/11111111-1111-4111-8111-111111111111/certificate.pdf",
      },
      { label: "Government ID", signedUrl: null },
      { label: "Selfie verification", signedUrl: null },
      { label: "Additional permit or certification", signedUrl: null },
    ]);
  });
});

describe("admin application review action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.requireAdmin.mockResolvedValue({ id: "admin-id" });
    adminMocks.createClient.mockResolvedValue(mockSupabase());
  });

  it("approves a submitted application as the verified admin", async () => {
    await reviewCookApplicationAction(
      reviewForm({
        cookId: "11111111-1111-4111-8111-111111111111",
        decision: "approved",
        reviewNotes: "",
      }),
    );

    expect(adminMocks.requireAdmin).toHaveBeenCalled();
    expect(adminMocks.updateApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        reviewed_by: "admin-id",
        review_notes: null,
      }),
    );
    expect(adminMocks.revalidatePath).toHaveBeenCalledWith("/admin/cook-applications/");
    expect(adminMocks.revalidatePath).toHaveBeenCalledWith("/admin/cooks/");
    expect(adminMocks.revalidatePath).toHaveBeenCalledWith("/admin/metrics/");
  });

  it("rejects invalid decisions before updating the database", async () => {
    await reviewCookApplicationAction(
      reviewForm({
        cookId: "11111111-1111-4111-8111-111111111111",
        decision: "rejected",
        reviewNotes: "",
      }),
    );

    expect(adminMocks.requireAdmin).toHaveBeenCalled();
    expect(adminMocks.createClient).not.toHaveBeenCalled();
    expect(adminMocks.updateApplication).not.toHaveBeenCalled();
  });
});
