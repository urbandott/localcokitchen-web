import type { Metadata } from "next";
import { retryNotificationAction } from "@/features/admin/actions";
import { listAdminNotifications } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import type { AdminNotificationSummary, NotificationOutbox } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Admin Notifications",
  description: "Review LocalCoKitchen notification delivery health.",
  path: "/admin/notifications/",
  noIndex: true,
});

const statusOptions: Array<[string, string]> = [
  ["all", "All statuses"],
  ["pending", "Pending"],
  ["processing", "Processing"],
  ["sent", "Sent"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
];

const summaryStatuses: NotificationOutbox["status"][] = [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
];

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function notificationSummaryCount(
  summary: AdminNotificationSummary[],
  status: NotificationOutbox["status"],
): number {
  return summary.find((row) => row.status === status)?.total_count ?? 0;
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const filters = (await searchParams) ?? {};
  const selectedStatus = filters.status ?? "all";
  const { error, notifications, summary } = await listAdminNotifications({
    status: selectedStatus,
  });
  const totalVisible = notifications[0]?.total_count ?? 0;

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Notification delivery</h1>
        <p className="lede">
          Monitor queued, sent, and failed email notifications. Payload JSON and unmasked recipient
          addresses are intentionally not exposed.
        </p>
      </section>

      <section className="next-card-grid" aria-label="Notification status summary">
        {summaryStatuses.map((status) => (
          <article className="next-card" key={status}>
            <h2>{status.replaceAll("_", " ")}</h2>
            <p>{notificationSummaryCount(summary, status)} notifications</p>
          </article>
        ))}
      </section>

      <form className="audit-filter-form">
        <label>
          <span>Status</span>
          <select name="status" defaultValue={selectedStatus}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-action compact-action" type="submit">
          Apply filters
        </button>
      </form>

      {error ? <p className="next-alert">{error}</p> : null}
      {!error && notifications.length === 0 ? (
        <p className="empty-state">No notifications found for this filter.</p>
      ) : null}

      <section className="next-section" aria-labelledby="admin-notifications-title">
        <div className="section-heading-row">
          <h2 id="admin-notifications-title">Recent notifications</h2>
          <p>{totalVisible} matching notifications</p>
        </div>
        <div className="order-list">
          {notifications.map((notification) => (
            <article
              className="order-list-card admin-notification-card"
              key={notification.notification_id}
            >
              <div>
                <span className="status-pill">{notification.status}</span>
                <h3>{notification.notification_type}</h3>
                <p>
                  {notification.recipient_email_masked} · {notification.channel} ·{" "}
                  {notification.template_key}
                </p>
                <p>
                  Target: {notification.target_type}
                  {notification.target_id ? ` #${notification.target_id.slice(0, 8)}` : ""} ·
                  attempts {notification.attempts}
                </p>
                <p>
                  Created {formatDateTime(notification.created_at)} · next attempt{" "}
                  {formatDateTime(notification.next_attempt_at)}
                </p>
                {notification.sent_at ? <p>Sent {formatDateTime(notification.sent_at)}</p> : null}
                {notification.last_error ? <p>Error: {notification.last_error}</p> : null}
              </div>
              {notification.status === "failed" || notification.status === "pending" ? (
                <form action={retryNotificationAction}>
                  <input name="notificationId" type="hidden" value={notification.notification_id} />
                  <button className="secondary-action compact-action" type="submit">
                    Retry now
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
