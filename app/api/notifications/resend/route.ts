import { NextResponse } from "next/server";
import { renderNotificationEmail, sendResendEmail } from "@/features/notifications/resend";
import { getServerEnv } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const workerHeader = request.headers.get("x-notification-worker-secret");
  return bearer === secret || workerHeader === secret;
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!authorized(request, env.NOTIFICATION_WORKER_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

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

  return NextResponse.json({ ok: true, claimed: notifications?.length ?? 0, failed, sent });
}
