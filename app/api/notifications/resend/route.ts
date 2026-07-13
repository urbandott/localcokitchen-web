import { NextResponse } from "next/server";
import {
  renderNotificationEmail,
  renderOpsNotificationHealthEmail,
  sendResendEmail,
} from "@/features/notifications/resend";
import { getServerEnv } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

const NOTIFICATION_CRON_SCHEDULE = "*/5 * * * *";
type PrivilegedClient = NonNullable<ReturnType<typeof createPrivilegedClient>>;

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const workerHeader = request.headers.get("x-notification-worker-secret");
  return bearer === secret || workerHeader === secret;
}

function authorizedVercelCron(request: Request): boolean {
  const userAgent = request.headers.get("user-agent") ?? "";
  const schedule = request.headers.get("x-vercel-cron-schedule");
  return userAgent.includes("vercel-cron/1.0") && schedule === NOTIFICATION_CRON_SCHEDULE;
}

async function processPendingNotifications(env: ReturnType<typeof getServerEnv>) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return NextResponse.json(
      { ok: false, error: "Notification worker is not configured." },
      { status: 503 },
    );
  }

  const supabase = createPrivilegedClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const { data: notifications, error } = await supabase
    .schema("lck_private")
    .rpc("claim_pending_notifications", { p_limit: 25 });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Notifications could not be claimed." },
      { status: 500 },
    );
  }

  let sent = 0;
  let failed = 0;
  for (const notification of notifications ?? []) {
    try {
      const email = renderNotificationEmail(notification);
      await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL,
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: notification.recipient_email,
      });
      await supabase
        .schema("lck_private")
        .rpc("mark_notification_sent", { p_notification_id: notification.id });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      await supabase.schema("lck_private").rpc("mark_notification_failed", {
        p_error: sendError instanceof Error ? sendError.message : "Unknown Resend failure.",
        p_notification_id: notification.id,
      });
    }
  }

  const healthAlerts = await processNotificationHealthAlerts(supabase, env);

  return NextResponse.json({
    ok: true,
    alertsFailed: healthAlerts.failed,
    alertsSent: healthAlerts.sent,
    claimed: notifications?.length ?? 0,
    failed,
    sent,
  });
}

async function processNotificationHealthAlerts(
  supabase: PrivilegedClient,
  env: ReturnType<typeof getServerEnv>,
): Promise<{ failed: number; sent: number }> {
  if (!env.NOTIFICATION_ALERT_EMAIL || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return { failed: 0, sent: 0 };
  }

  const { data: alerts, error } = await supabase
    .schema("lck_private")
    .rpc("claim_notification_health_alerts");

  if (error) return { failed: 1, sent: 0 };

  let sent = 0;
  let failed = 0;
  for (const alert of alerts ?? []) {
    try {
      const email = renderOpsNotificationHealthEmail(alert);
      await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL,
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: env.NOTIFICATION_ALERT_EMAIL,
      });
      await supabase
        .schema("lck_private")
        .rpc("mark_notification_health_alert_sent", { p_alert_key: alert.alert_key });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { failed, sent };
}

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!authorizedVercelCron(request) && !authorized(request, env.NOTIFICATION_WORKER_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return processPendingNotifications(env);
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!authorized(request, env.NOTIFICATION_WORKER_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return processPendingNotifications(env);
}
