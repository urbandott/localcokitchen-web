import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kitchenPageMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  hasWorkspace: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: kitchenPageMocks.redirect,
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "legacy-cook-id",
    email: "cook@example.com",
  }),
}));

vi.mock("@/features/kitchen/kitchen-data", () => ({
  getKitchenDashboard: kitchenPageMocks.getDashboard,
  userHasCookWorkspace: kitchenPageMocks.hasWorkspace,
}));

vi.mock("@/features/kitchen/cook-application-form", () => ({
  CookApplicationForm: () => <form aria-label="Cook application form" />,
}));

vi.mock("@/features/kitchen/kitchen-management-forms", () => ({
  CookProfileManagementForm: ({ liveDisabledReason }: { liveDisabledReason?: string | null }) => (
    <form aria-label="Cook profile management form">
      {liveDisabledReason ? <p>{liveDisabledReason}</p> : null}
    </form>
  ),
  MenuItemCreateForm: () => <form aria-label="Menu item create form" />,
  MenuItemEditForm: ({ item }: { item: { name: string } }) => (
    <form aria-label={`Menu item edit form ${item.name}`} />
  ),
  PickupWindowsForm: () => <form aria-label="Pickup windows form" />,
}));

vi.mock("@/features/kitchen/actions", () => ({
  setMenuItemAvailabilityAction: vi.fn(),
}));

import KitchenApplicationPage from "@/app/(cook)/my-kitchen/application/page";
import KitchenMenuItemsPage from "@/app/(cook)/my-kitchen/menu-items/page";
import MyKitchenPage from "@/app/(cook)/my-kitchen/page";
import KitchenProfilePage from "@/app/(cook)/my-kitchen/profile/page";

const approvedApplication = {
  user_id: "legacy-cook-id",
  legal_name: "Asha Cook",
  phone: "+1 312-555-0101",
  pickup_address: "123 Kitchen Lane",
  pickup_zip_code: "60601",
  food_handler_training_completed: true,
  food_handler_certificate_url: "legacy-cook-id/cert.pdf",
  permit_or_certification_url: null,
  government_id_document_url: "legacy-cook-id/id.pdf",
  selfie_verification_url: "legacy-cook-id/selfie.png",
  status: "approved",
  submitted_at: "2026-07-01T00:00:00.000Z",
  reviewed_at: "2026-07-02T00:00:00.000Z",
  reviewed_by: "admin-id",
  review_notes: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-02T00:00:00.000Z",
};

const menuItem = {
  id: "11111111-1111-4111-8111-111111111111",
  cook_id: "legacy-cook-id",
  name: "Chicken biryani",
  description: "Fragrant rice and chicken.",
  image_url: "legacy-cook-id/biryani.png",
  price_cents: 1250,
  quantity_available: 8,
  category: "Dinner",
  allergens: ["Dairy"],
  dietary_tags: ["Halal"],
  main_ingredients: ["Chicken", "Rice", "Spices"],
  portion_size: "24",
  portion_serves: 1,
  spice_level: "Medium",
  pickup_window_note: "Pickup after 5 PM",
  is_sold_out: false,
  is_active: true,
  created_at: "2026-07-03T00:00:00.000Z",
  updated_at: "2026-07-03T00:00:00.000Z",
};

describe("My Kitchen access", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    kitchenPageMocks.hasWorkspace.mockResolvedValue(true);
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: approvedApplication,
      profile: {
        cook_id: "legacy-cook-id",
        display_name: "Asha's Kitchen",
        profile_image_url: null,
        description: "Home cooked meals.",
        cuisine_type: "Pakistani",
        pickup_zip_code: "60601",
        preorder_cutoff_hours: 24,
        order_notes: "Bring your order number.",
        is_public: true,
        rating: 0,
        review_count: 0,
        moderator_disabled_at: null,
        moderator_disabled_by: null,
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
      menuItems: [menuItem],
      pickupWindows: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          cook_id: "legacy-cook-id",
          day_of_week: 1,
          start_time: "09:00:00",
          end_time: "17:00:00",
          is_active: true,
          created_at: "2026-07-02T00:00:00.000Z",
          updated_at: "2026-07-02T00:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("shows separate kitchen management cards for an existing cook", async () => {
    const page = await MyKitchenPage();

    await act(async () => {
      root.render(page);
    });

    expect(kitchenPageMocks.redirect).not.toHaveBeenCalled();
    expect(container.textContent).toContain("My Kitchen");
    expect(container.textContent).toContain("Status: Approved");
    expect(container.textContent).toContain("Manage application");
    expect(container.textContent).toContain("Manage public profile");
    expect(container.textContent).toContain("Manage my menu");
    expect(container.textContent).toContain("Manage orders");
    expect(container.textContent).not.toContain("View public menu");
  });

  it("truncates long public profile names inside the kitchen dashboard card", async () => {
    const longDisplayName = "Asha's ".repeat(40).trim();
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: approvedApplication,
      profile: {
        cook_id: "legacy-cook-id",
        display_name: longDisplayName,
        profile_image_url: null,
        description: "Home cooked meals.",
        cuisine_type: "Pakistani",
        pickup_zip_code: "60601",
        preorder_cutoff_hours: 24,
        order_notes: "Bring your order number.",
        is_public: true,
        rating: 0,
        review_count: 0,
        moderator_disabled_at: null,
        moderator_disabled_by: null,
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
      menuItems: [menuItem],
      pickupWindows: [],
      error: null,
    });

    const page = await MyKitchenPage();

    await act(async () => {
      root.render(page);
    });

    const name = container.querySelector(".text-truncate");
    expect(name?.textContent).toBe(longDisplayName);
    expect(name?.getAttribute("title")).toBe(longDisplayName);
  });

  it("shows the application form on the application page when onboarding has started", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: null,
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenApplicationPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Kitchen application");
    expect(container.querySelector("form[aria-label='Cook application form']")).not.toBeNull();
  });

  it("shows rejected review notes and allows resubmission on the application page", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "rejected",
        review_notes: "Please upload a clearer ID photo.",
        submitted_at: null,
        reviewed_at: "2026-07-04T00:00:00.000Z",
      },
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenApplicationPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Application details");
    expect(container.textContent).toContain("Please upload a clearer ID photo.");
    expect(container.querySelector("form[aria-label='Cook application form']")).not.toBeNull();
  });

  it("hides the application form and shows full details after submission", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "submitted",
        reviewed_at: null,
      },
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenApplicationPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Submitted for review");
    expect(container.textContent).toContain("Asha Cook");
    expect(container.textContent).toContain("+1 312-555-0101");
    expect(container.textContent).toContain("60601");
    expect(container.querySelector("form[aria-label='Cook application form']")).toBeNull();
  });

  it("shows only status dates and the form for draft applications", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "draft",
        legal_name: "Draft Cook",
        submitted_at: null,
        reviewed_at: null,
      },
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenApplicationPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Not submitted");
    expect(container.textContent).not.toContain("Draft Cook");
    expect(container.querySelector("form[aria-label='Cook application form']")).not.toBeNull();
  });

  it("shows public profile and pickup window forms on the approved profile page", async () => {
    const page = await KitchenProfilePage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Public profile");
    expect(
      container.querySelector("form[aria-label='Cook profile management form']"),
    ).not.toBeNull();
    expect(container.querySelector("form[aria-label='Pickup windows form']")).not.toBeNull();
  });

  it("lets submitted cooks prepare their profile and pickup windows before approval", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "submitted",
        reviewed_at: null,
      },
      profile: {
        cook_id: "legacy-cook-id",
        display_name: "Asha's Kitchen",
        profile_image_url: null,
        description: "Home cooked meals.",
        cuisine_type: "Pakistani",
        pickup_zip_code: "60601",
        preorder_cutoff_hours: 24,
        order_notes: "Bring your order number.",
        is_public: false,
        rating: 0,
        review_count: 0,
        moderator_disabled_at: null,
        moderator_disabled_by: null,
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenProfilePage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("You can prepare your public profile");
    expect(container.textContent).not.toContain("Kitchen live status unlocks");
    expect(
      container.querySelector("form[aria-label='Cook profile management form']"),
    ).not.toBeNull();
    expect(container.querySelector("form[aria-label='Pickup windows form']")).not.toBeNull();
  });

  it("shows only the cook's own menu management on the menu items page", async () => {
    const page = await KitchenMenuItemsPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("My menu items");
    expect(container.textContent).toContain("Chicken biryani");
    expect(container.textContent).toContain("Mark sold out");
    expect(container.querySelector("form[aria-label='Menu item create form']")).not.toBeNull();
    expect(
      container.querySelector("form[aria-label='Menu item edit form Chicken biryani']"),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Available menu items");
  });

  it("lets submitted cooks prepare menu items before approval when a profile exists", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "submitted",
        reviewed_at: null,
      },
      profile: {
        cook_id: "legacy-cook-id",
        display_name: "Asha's Kitchen",
        profile_image_url: null,
        description: "Home cooked meals.",
        cuisine_type: "Pakistani",
        pickup_zip_code: "60601",
        preorder_cutoff_hours: 24,
        order_notes: "Bring your order number.",
        is_public: false,
        rating: 0,
        review_count: 0,
        moderator_disabled_at: null,
        moderator_disabled_by: null,
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
      menuItems: [menuItem],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenMenuItemsPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("You can prepare menu items before approval");
    expect(container.querySelector("form[aria-label='Menu item create form']")).not.toBeNull();
    expect(
      container.querySelector("form[aria-label='Menu item edit form Chicken biryani']"),
    ).not.toBeNull();
  });

  it("requires a prepared public profile before adding menu items", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        ...approvedApplication,
        status: "submitted",
        reviewed_at: null,
      },
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: null,
    });

    const page = await KitchenMenuItemsPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Save your public profile first");
    expect(container.querySelector("form[aria-label='Menu item create form']")).toBeNull();
  });
});
