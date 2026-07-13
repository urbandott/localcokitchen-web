import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderNotificationEmail, sendResendEmail } from "@/features/notifications/resend";
import type { NotificationOutbox } from "@/types/database";

const routeMocks = vi.hoisted(() => ({
  createPrivilegedClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedClient: routeMocks.createPrivilegedClient,
}));

import { POST } from "@/app/api/notifications/resend/route";

const notification: NotificationOutbox = {
  attempts: 1,
  channel: "email",
  created_at: "2026-07-13T00:00:00.000Z",
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  last_error: null,
  next_attempt_at: "2026-07-13T00:00:00.000Z",
  notification_type: "order_item.ready",
  payload: {
    item_name: "<script>alert(1)</script>",
    order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  },
  recipient_email: "customer@example.com",
  recipient_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  sent_at: null,
  status: "processing",
  target_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  target_type: "customer_order_item",
  template_key: "customer_order_item_ready",
  updated_at: "2026-07-13T00:00:00.000Z",
};

describe("Resend notification worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://localcokitchen.test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key-that-is-long";
    process.env.SUPABASE_SECRET_KEY = "server-secret-key-that-is-long";
    process.env.NOTIFICATION_WORKER_SECRET = "worker-secret-that-is-long";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "LocalCoKitchen <orders@localcokitchen.com>";
    routeMocks.rpc.mockImplementation((name: string) => {
      if (name === "claim_pending_notifications") {
        return Promise.resolve({ data: [notification], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    routeMocks.createPrivilegedClient.mockReturnValue({
      schema: () => ({ rpc: routeMocks.rpc }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders escaped notification content", () => {
    const email = renderNotificationEmail(notification);

    expect(email.subject).toContain("bbbbbbbb");
    expect(email.text).toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("sends email through Resend with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendResendEmail({
        apiKey: "re_test_key",
        from: "LocalCoKitchen <orders@localcokitchen.com>",
        html: "<p>Hello</p>",
        subject: "Hello",
        text: "Hello",
        to: "customer@example.com",
      }),
    ).resolves.toEqual({ id: "email_123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
        method: "POST",
      }),
    );
  });

  it("rejects unauthorized worker requests before touching Supabase", async () => {
    const response = await POST(
      new Request("https://local.test/api/notifications/resend", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(routeMocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("claims notifications, sends through Resend, and marks sent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email_123" }),
      }),
    );

    const response = await POST(
      new Request("https://local.test/api/notifications/resend", {
        method: "POST",
        headers: { authorization: "Bearer worker-secret-that-is-long" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ claimed: 1, failed: 0, sent: 1 });
    expect(routeMocks.rpc).toHaveBeenCalledWith("claim_pending_notifications", { p_limit: 25 });
    expect(routeMocks.rpc).toHaveBeenCalledWith("mark_notification_sent", {
      p_notification_id: notification.id,
    });
  });
});
