import { beforeEach, describe, expect, it, vi } from "vitest";

const adminNotificationMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: adminNotificationMocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: adminNotificationMocks.requireAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: adminNotificationMocks.createClient,
}));

import { retryNotificationAction } from "@/features/admin/actions";
import { listAdminNotifications } from "@/features/admin/admin-data";
import { getAdminNotificationHealthAlerts } from "@/features/admin/notification-health";

function retryForm(notificationId: string) {
  const formData = new FormData();
  formData.set("notificationId", notificationId);
  return formData;
}

describe("admin notification observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminNotificationMocks.requireAdmin.mockResolvedValue({ id: "admin-id" });
    adminNotificationMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_admin_notification_summary") {
        return Promise.resolve({
          data: [
            {
              newest_created_at: "2026-07-13T00:00:00.000Z",
              oldest_created_at: null,
              status: "failed",
              total_count: 1,
            },
          ],
          error: null,
        });
      }
      if (name === "list_admin_notifications") {
        return Promise.resolve({
          data: [
            {
              attempts: 5,
              channel: "email",
              created_at: "2026-07-13T00:00:00.000Z",
              last_error: "temporary failure",
              next_attempt_at: "2026-07-13T00:05:00.000Z",
              notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              notification_type: "order.payment_confirmed",
              recipient_email_masked: "cu***@example.com",
              sent_at: null,
              status: "failed",
              target_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              target_type: "customer_order",
              template_key: "customer_order_payment_confirmed",
              total_count: 1,
              updated_at: "2026-07-13T00:00:00.000Z",
            },
          ],
          error: null,
        });
      }
      if (name === "retry_admin_notification") {
        return Promise.resolve({ data: true, error: null });
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    adminNotificationMocks.createClient.mockResolvedValue({
      schema: () => ({ rpc: adminNotificationMocks.rpc }),
    });
  });

  it("uses allowlisted status filters and returns sanitized notification rows", async () => {
    const result = await listAdminNotifications({ status: "not-a-real-status" });

    expect(result.error).toBeNull();
    expect(result.summary).toHaveLength(1);
    expect(result.notifications).toHaveLength(1);
    expect(JSON.stringify(result.notifications)).not.toMatch(/recipient_email"|payload|secret/i);
    expect(adminNotificationMocks.rpc).toHaveBeenCalledWith("list_admin_notifications", {
      p_limit: 75,
      p_offset: 0,
      p_status: "all",
    });
  });

  it("retries a valid notification as an authenticated admin", async () => {
    await retryNotificationAction(retryForm("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));

    expect(adminNotificationMocks.requireAdmin).toHaveBeenCalled();
    expect(adminNotificationMocks.rpc).toHaveBeenCalledWith("retry_admin_notification", {
      p_notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(adminNotificationMocks.revalidatePath).toHaveBeenCalledWith("/admin/notifications/");
  });

  it("rejects invalid retry IDs before calling Supabase", async () => {
    await retryNotificationAction(retryForm("bad-id"));

    expect(adminNotificationMocks.requireAdmin).toHaveBeenCalled();
    expect(adminNotificationMocks.rpc).not.toHaveBeenCalledWith(
      "retry_admin_notification",
      expect.anything(),
    );
  });

  it("raises health alerts for failed delivery volume and stale pending notifications", () => {
    const alerts = getAdminNotificationHealthAlerts(
      [
        {
          newest_created_at: "2026-07-13T00:00:00.000Z",
          oldest_created_at: "2026-07-13T00:00:00.000Z",
          status: "pending",
          total_count: 3,
        },
        {
          newest_created_at: "2026-07-13T00:20:00.000Z",
          oldest_created_at: "2026-07-13T00:10:00.000Z",
          status: "failed",
          total_count: 5,
        },
      ],
      new Date("2026-07-13T00:31:00.000Z"),
    );

    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ severity: "warning" });
    expect(alerts[0]?.message).toContain("5 notifications have failed");
    expect(alerts[1]?.message).toContain("31 minutes");
  });

  it("does not raise health alerts for normal notification state", () => {
    const alerts = getAdminNotificationHealthAlerts(
      [
        {
          newest_created_at: "2026-07-13T00:25:00.000Z",
          oldest_created_at: "2026-07-13T00:20:00.000Z",
          status: "pending",
          total_count: 2,
        },
        {
          newest_created_at: "2026-07-13T00:20:00.000Z",
          oldest_created_at: "2026-07-13T00:10:00.000Z",
          status: "failed",
          total_count: 1,
        },
      ],
      new Date("2026-07-13T00:31:00.000Z"),
    );

    expect(alerts).toEqual([]);
  });
});
