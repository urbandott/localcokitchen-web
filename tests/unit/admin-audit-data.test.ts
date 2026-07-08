import { beforeEach, describe, expect, it, vi } from "vitest";

const adminAuditMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: adminAuditMocks.createClient,
}));

import { listAdminAuditEvents } from "@/features/admin/admin-data";

describe("admin audit data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminAuditMocks.rpc.mockResolvedValue({
      data: [
        {
          actor_user_id: null,
          created_at: "2026-07-08T01:00:00.000Z",
          event_name: "payment.webhook_received",
          event_source: "system_event",
          metadata: { provider: "stripe" },
          severity: "info",
          target_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          target_type: "payment_webhook_event",
        },
      ],
      error: null,
    });
    adminAuditMocks.createClient.mockResolvedValue({
      schema: () => ({ rpc: adminAuditMocks.rpc }),
    });
  });

  it("uses allowlisted filters and drops invalid query values before RPC", async () => {
    const result = await listAdminAuditEvents({
      eventSource: "system_event",
      targetType: "bad-target",
    });

    expect(result.error).toBeNull();
    expect(result.events).toHaveLength(1);
    expect(adminAuditMocks.rpc).toHaveBeenCalledWith("list_admin_audit_events", {
      p_event_type: "system_event",
      p_limit: 75,
      p_offset: 0,
      p_target_type: null,
    });
  });
});
