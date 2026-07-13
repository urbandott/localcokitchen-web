import { BRAND_NAME } from "@/lib/brand";
import type { Json, NotificationOutbox, OpsNotificationHealthAlert } from "@/types/database";

export type ResendEmailRequest = {
  apiKey: string;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function payloadRecord(payload: Json): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

function orderSuffix(payload: Record<string, unknown>): string {
  const orderId = typeof payload.order_id === "string" ? payload.order_id.slice(0, 8) : "";
  return orderId ? ` #${orderId}` : "";
}

export function renderNotificationEmail(notification: NotificationOutbox): {
  html: string;
  subject: string;
  text: string;
} {
  const payload = payloadRecord(notification.payload);
  const suffix = orderSuffix(payload);

  const subjects: Record<string, string> = {
    cook_order_paid: `New paid order${suffix}`,
    customer_order_cancelled: `Your order${suffix} was cancelled`,
    customer_order_fulfilled: `Your order${suffix} was fulfilled`,
    customer_order_item_fulfilled: `An item in your order${suffix} was fulfilled`,
    customer_order_item_ready: `An item in your order${suffix} is ready`,
    customer_order_payment_confirmed: `Payment confirmed for order${suffix}`,
    customer_order_refunded: `Your order${suffix} was refunded`,
  };

  const subject = subjects[notification.template_key] ?? `Update from ${BRAND_NAME}`;
  const itemName = typeof payload.item_name === "string" ? payload.item_name : null;
  const lines = [
    subject,
    "",
    itemName ? `Item: ${itemName}` : null,
    "Open LocalCoKitchen for the latest order details.",
    "",
    "If you have questions, contact info@localcokitchen.com.",
  ].filter((line): line is string => line !== null);

  const text = lines.join("\n");
  const html = `<p>${lines.map((line) => escapeHtml(line)).join("</p><p>")}</p>`;
  return { html, subject, text };
}

export function renderOpsNotificationHealthEmail(alert: OpsNotificationHealthAlert): {
  html: string;
  subject: string;
  text: string;
} {
  const severity = alert.severity === "critical" ? "Critical" : "Warning";
  const subject = `[${BRAND_NAME}] ${severity}: notification delivery health`;
  const lines = [
    subject,
    "",
    alert.message,
    "",
    "Open the LocalCoKitchen admin notification delivery page to review failed and pending notifications.",
  ];
  const text = lines.join("\n");
  const html = `<p>${lines.map((line) => escapeHtml(line)).join("</p><p>")}</p>`;
  return { html, subject, text };
}

export async function sendResendEmail(request: ResendEmailRequest): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: request.from,
      html: request.html,
      subject: request.subject,
      text: request.text,
      to: [request.to],
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Resend email request failed.");
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { id?: unknown }).id !== "string"
  ) {
    throw new Error("Resend response was invalid.");
  }

  return { id: (payload as { id: string }).id };
}
