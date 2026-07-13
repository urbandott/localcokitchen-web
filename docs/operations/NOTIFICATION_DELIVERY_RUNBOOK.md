# Notification Delivery Incident Runbook

Use this runbook when LocalCoKitchen order/customer/cook notification emails are delayed, failing, or not being delivered.

## Scope

Notification delivery uses:

- `lck_private.notification_outbox` for queued notification jobs.
- `/api/notifications/resend` for the server-only worker.
- Vercel Cron every 5 minutes via `vercel.json`.
- Resend for outbound email.
- `/admin/notifications/` for admin visibility and manual retry.
- `NOTIFICATION_ALERT_EMAIL` for throttled operations alerts.

The worker must never run from browser/client code and must never expose service-role credentials.

## Severity

- **SEV-1:** customers/cooks are not receiving order lifecycle emails and the issue affects active orders.
- **SEV-2:** failed notifications are accumulating, but order flow still works.
- **SEV-3:** stale pending notifications or degraded delivery with no customer report yet.

## First checks

1. Open `/admin/notifications/`.
2. Check summary cards:
   - `failed >= 5` means delivery needs review.
   - oldest pending `>= 30 minutes` means the cron worker may not be running.
3. Check the latest failed notification error text.
4. Confirm production env vars:

   ```text
   SUPABASE_SECRET_KEY
   NOTIFICATION_WORKER_SECRET
   NOTIFICATION_ALERT_EMAIL
   RESEND_API_KEY
   RESEND_FROM_EMAIL
   NEXT_PUBLIC_SUPABASE_URL
   ```

5. Confirm Vercel Cron is deployed and points to:

   ```text
   /api/notifications/resend
   ```

6. Confirm Resend account/API status and sender/domain verification.

## Manual worker test

From a trusted server environment only:

```sh
curl -X POST https://localcokitchen.com/api/notifications/resend \
  -H "Authorization: Bearer $NOTIFICATION_WORKER_SECRET"
```

Expected response shape:

```json
{
  "ok": true,
  "claimed": 0,
  "sent": 0,
  "failed": 0,
  "alertsSent": 0,
  "alertsFailed": 0
}
```

Do not paste secrets into tickets, chat, browser consoles, or screenshots.

## Recovery steps

1. If env vars are missing or changed, restore them in the deployment environment and redeploy/restart as needed.
2. If Resend rejects messages:
   - verify `RESEND_API_KEY`;
   - verify `RESEND_FROM_EMAIL`;
   - verify sender domain status;
   - check for provider outage or rate limits.
3. If cron is not firing:
   - verify `vercel.json`;
   - verify the production deployment includes the cron config;
   - manually run the POST worker to drain urgent jobs.
4. If notifications are failed but configuration is now fixed:
   - open `/admin/notifications/?status=failed`;
   - use `Retry now` for affected notifications;
   - confirm they move to `sent`.
5. If pending notifications are stale:
   - manually run the worker;
   - check Vercel function logs for `/api/notifications/resend`;
   - check Supabase connectivity and `SUPABASE_SECRET_KEY`.

## Database checks

Use read-only SQL unless an incident commander explicitly approves changes.

```sql
select status, count(*), min(created_at), max(created_at)
from lck_private.notification_outbox
group by status
order by status;
```

```sql
select notification_type, status, attempts, next_attempt_at, left(last_error, 250), created_at
from lck_private.notification_outbox
order by created_at desc
limit 25;
```

## Alert throttling

Operations alerts are throttled in:

```text
lck_private.notification_health_alert_state
```

Current behavior:

- alert claim throttle: 10 minutes;
- successful email throttle: 1 hour;
- alert email destination: `NOTIFICATION_ALERT_EMAIL`.

## Confirm recovery

Recovery is confirmed when:

- new order lifecycle notifications reach `sent`;
- failed count stops increasing;
- stale pending count clears;
- manual worker response shows no unexpected `failed` or `alertsFailed`;
- no new operations alert arrives during the next throttle window.

## Escalation

Escalate to engineering/on-call if:

- payment/order flow is affected;
- Resend is healthy but sends still fail;
- Supabase RPCs return authorization/configuration errors;
- pending notifications remain stale after a successful manual worker call;
- the same alert repeats after one hour.

## Post-incident follow-up

Create an incident note with:

- start/end time;
- customer/cook impact;
- root cause;
- failed/pending counts;
- actions taken;
- whether retries succeeded;
- prevention items.
