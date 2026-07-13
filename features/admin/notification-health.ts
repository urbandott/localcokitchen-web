import type { AdminNotificationSummary, NotificationOutbox } from "@/types/database";

export const FAILED_NOTIFICATION_ALERT_THRESHOLD = 5;
export const STALE_PENDING_NOTIFICATION_MINUTES = 30;

export type AdminNotificationHealthAlert = {
  message: string;
  severity: "warning" | "critical";
};

function summaryForStatus(
  summary: AdminNotificationSummary[],
  status: NotificationOutbox["status"],
): AdminNotificationSummary | null {
  return summary.find((row) => row.status === status) ?? null;
}

export function getAdminNotificationHealthAlerts(
  summary: AdminNotificationSummary[],
  now: Date = new Date(),
): AdminNotificationHealthAlert[] {
  const alerts: AdminNotificationHealthAlert[] = [];
  const failed = summaryForStatus(summary, "failed");
  const pending = summaryForStatus(summary, "pending");
  const failedCount = failed?.total_count ?? 0;

  if (failedCount >= FAILED_NOTIFICATION_ALERT_THRESHOLD) {
    alerts.push({
      message: `${failedCount} notifications have failed delivery. Review recent failures and retry after confirming Resend health.`,
      severity: failedCount >= FAILED_NOTIFICATION_ALERT_THRESHOLD * 2 ? "critical" : "warning",
    });
  }

  if (pending?.oldest_created_at) {
    const ageMinutes = Math.floor(
      (now.getTime() - new Date(pending.oldest_created_at).getTime()) / 60_000,
    );
    if (ageMinutes >= STALE_PENDING_NOTIFICATION_MINUTES) {
      alerts.push({
        message: `The oldest pending notification has been waiting ${ageMinutes} minutes. Check the cron worker and environment variables.`,
        severity: ageMinutes >= STALE_PENDING_NOTIFICATION_MINUTES * 2 ? "critical" : "warning",
      });
    }
  }

  return alerts;
}
