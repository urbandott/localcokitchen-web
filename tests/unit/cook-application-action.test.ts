import { beforeEach, describe, expect, it, vi } from "vitest";

const kitchenMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  currentApplication: vi.fn(),
  revalidatePath: vi.fn(),
  remove: vi.fn(),
  savedApplication: vi.fn(),
  upload: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: kitchenMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: kitchenMocks.createClient,
}));

import { submitCookApplicationAction } from "@/features/kitchen/actions";
import {
  detectCookApplicationFile,
  normalizeUsPhone,
  validateCookApplicationFileBytes,
} from "@/features/kitchen/application-validation";

const initialState = { ok: false, message: "" };
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function validApplicationData() {
  const formData = new FormData();
  formData.set("legalName", " Asha Cook ");
  formData.set("phone", "(312) 555-0142");
  formData.set("pickupAddress", "123 Kitchen Lane");
  formData.set("pickupZipCode", "60601");
  formData.set("foodHandlerTrainingCompleted", "on");
  formData.set(
    "foodHandlerCertificate",
    new File([pdfBytes], "certificate.pdf", { type: "application/pdf" }),
  );
  formData.set(
    "governmentIdDocument",
    new File([pdfBytes], "drivers-license.pdf", { type: "application/pdf" }),
  );
  formData.set("selfieVerification", new File([pngBytes], "selfie.png", { type: "image/png" }));
  return formData;
}

describe("cook application validation helpers", () => {
  it("normalizes common US phone number formats to the database format", () => {
    expect(normalizeUsPhone("(312) 555-0142")).toBe("+1 312-555-0142");
    expect(normalizeUsPhone("1-312-555-0142")).toBe("+1 312-555-0142");
  });

  it("detects supported files by signature and rejects PDFs for image-only fields", () => {
    expect(detectCookApplicationFile(pdfBytes)).toEqual({
      contentType: "application/pdf",
      extension: "pdf",
    });
    expect(validateCookApplicationFileBytes(pdfBytes, { imagesOnly: true })).toBeNull();
    expect(validateCookApplicationFileBytes(pngBytes, { imagesOnly: true })).toEqual({
      contentType: "image/png",
      extension: "png",
    });
  });
});

describe("cook application action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kitchenMocks.currentApplication.mockResolvedValue({ data: null, error: null });
    kitchenMocks.savedApplication.mockResolvedValue({
      data: { user_id: "user-id", status: "submitted" },
      error: null,
    });
    kitchenMocks.upload.mockResolvedValue({ data: { path: "uploaded" }, error: null });
    kitchenMocks.remove.mockResolvedValue({ data: [], error: null });
    kitchenMocks.upsert.mockImplementation(() => ({
      select: () => ({
        single: kitchenMocks.savedApplication,
      }),
    }));
    kitchenMocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-id" } },
          error: null,
        }),
      },
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: kitchenMocks.currentApplication,
            }),
          }),
          upsert: kitchenMocks.upsert,
        }),
      }),
      storage: {
        from: () => ({
          remove: kitchenMocks.remove,
          upload: kitchenMocks.upload,
        }),
      },
    });
  });

  it("rejects missing required documents before uploading", async () => {
    const data = validApplicationData();
    data.delete("governmentIdDocument");

    const result = await submitCookApplicationAction(initialState, data);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.governmentIdDocument).toMatch(/required/i);
    expect(kitchenMocks.upload).not.toHaveBeenCalled();
    expect(kitchenMocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects MIME-spoofed application documents", async () => {
    const data = validApplicationData();
    data.set(
      "foodHandlerCertificate",
      new File(["not a pdf"], "certificate.pdf", {
        type: "application/pdf",
      }),
    );

    const result = await submitCookApplicationAction(initialState, data);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.foodHandlerCertificate).toMatch(/valid PDF/i);
    expect(kitchenMocks.upload).not.toHaveBeenCalled();
  });

  it("submits a first-time application with generated owner-scoped document paths", async () => {
    const result = await submitCookApplicationAction(initialState, validApplicationData());

    expect(result).toEqual({
      ok: true,
      message: "Your cook application has been submitted for review.",
    });
    expect(kitchenMocks.upload).toHaveBeenCalledTimes(3);
    expect(kitchenMocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-id\/[0-9a-f-]+\.pdf$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(kitchenMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        legal_name: "Asha Cook",
        phone: "+1 312-555-0142",
        status: "submitted",
        food_handler_certificate_url: expect.stringMatching(/^user-id\/[0-9a-f-]+\.pdf$/),
        government_id_document_url: expect.stringMatching(/^user-id\/[0-9a-f-]+\.pdf$/),
        selfie_verification_url: expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
      }),
      { onConflict: "user_id" },
    );
    expect(kitchenMocks.revalidatePath).toHaveBeenCalledWith("/my-kitchen/");
  });

  it("does not allow resubmission while an application is already pending", async () => {
    kitchenMocks.currentApplication.mockResolvedValue({
      data: { status: "submitted" },
      error: null,
    });

    const result = await submitCookApplicationAction(initialState, validApplicationData());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already submitted/i);
    expect(kitchenMocks.upload).not.toHaveBeenCalled();
  });

  it("cleans up newly uploaded files if the database save fails", async () => {
    kitchenMocks.savedApplication.mockResolvedValue({
      data: null,
      error: { message: "failed" },
    });

    const result = await submitCookApplicationAction(initialState, validApplicationData());

    expect(result.ok).toBe(false);
    expect(kitchenMocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(/^user-id\/[0-9a-f-]+\.(pdf|png)$/)]),
    );
  });
});
