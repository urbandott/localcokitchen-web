import type { Metadata } from "next";
import { listAdminAuditEvents } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import type { AdminAuditEvent } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Admin Audit Events",
  description: "Review LocalCoKitchen security and operational audit events.",
  path: "/admin/audit/",
  noIndex: true,
});

const sourceOptions = [
  ["", "All sources"],
  ["admin_action", "Admin actions"],
  ["system_event", "System events"],
];

const targetOptions = [
  ["", "All targets"],
  ["admin", "Admin"],
  ["cook", "Cook"],
  ["customer_order", "Customer order"],
  ["customer_order_item", "Order item"],
  ["customer_payment_attempt", "Payment attempt"],
  ["payment_webhook_event", "Payment webhook"],
];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function metadataPreview(metadata: AdminAuditEvent["metadata"]): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "No metadata";
  const safeEntries = Object.entries(metadata)
    .filter(([key]) => !/payload|secret|token|provider_reference/i.test(key))
    .slice(0, 6);
  if (!safeEntries.length) return "No metadata";
  return safeEntries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventSource?: string; targetType?: string }>;
}) {
  await requireAdmin();
  const filters = (await searchParams) ?? {};
  const { error, events } = await listAdminAuditEvents(filters);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Audit events</h1>
        <p className="lede">
          Inspect recent security and operational events. Raw webhook payloads, provider references,
          tokens, and secrets are not exposed here.
        </p>
      </section>

      <form className="audit-filter-form">
        <label>
          <span>Source</span>
          <select name="eventSource" defaultValue={filters.eventSource ?? ""}>
            {sourceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Target</span>
          <select name="targetType" defaultValue={filters.targetType ?? ""}>
            {targetOptions.map(([value, label]) => (
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
      {!error && events.length === 0 ? <p className="empty-state">No audit events found.</p> : null}

      <section className="next-section" aria-label="Recent audit events">
        <div className="order-list">
          {events.map((event) => (
            <article
              className="order-list-card admin-audit-card"
              key={`${event.event_source}-${event.event_name}-${event.created_at}-${event.target_id}`}
            >
              <div>
                <span className="status-pill">{event.severity}</span>
                <h2 className="text-truncate" title={event.event_name}>
                  {event.event_name}
                </h2>
                <p className="text-wrap-safe">
                  {event.event_source} · {event.target_type}
                  {event.target_id ? ` #${event.target_id.slice(0, 8)}` : ""} ·{" "}
                  {formatDateTime(event.created_at)}
                </p>
                <p>Actor: {event.actor_user_id ? event.actor_user_id.slice(0, 8) : "system"}</p>
                <p className="text-wrap-safe">{metadataPreview(event.metadata)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
