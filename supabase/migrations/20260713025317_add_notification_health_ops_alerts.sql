create table if not exists lck_private.notification_health_alert_state (
  alert_key text primary key check (char_length(alert_key) between 3 and 120),
  severity text not null check (severity in ('warning', 'critical')),
  message text not null check (char_length(message) between 3 and 1000),
  last_seen_at timestamptz not null default now(),
  last_claimed_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_notification_health_alert_state_updated_at
  on lck_private.notification_health_alert_state;
create trigger set_notification_health_alert_state_updated_at
  before update on lck_private.notification_health_alert_state
  for each row execute function lck_private.set_updated_at();

alter table lck_private.notification_health_alert_state enable row level security;
revoke all on table lck_private.notification_health_alert_state
  from public, anon, authenticated;

drop function if exists lck_private.claim_notification_health_alerts();
create function lck_private.claim_notification_health_alerts()
returns table (
  alert_key text,
  severity text,
  message text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  return query
  with summary as (
    select
      notification.status,
      count(*)::bigint as total_count,
      min(notification.created_at) as oldest_created_at
    from lck_private.notification_outbox notification
    group by notification.status
  ), current_alerts as (
    select
      'failed_notifications'::text as alert_key,
      case when summary.total_count >= 10 then 'critical' else 'warning' end as severity,
      (summary.total_count::text || ' notifications have failed delivery. Review recent failures and retry after confirming Resend health.')::text as message
    from summary
    where summary.status = 'failed'
      and summary.total_count >= 5
    union all
    select
      'stale_pending_notifications'::text as alert_key,
      case when extract(epoch from (now() - summary.oldest_created_at)) >= 3600 then 'critical' else 'warning' end as severity,
      ('The oldest pending notification has been waiting '
        || floor(extract(epoch from (now() - summary.oldest_created_at)) / 60)::text
        || ' minutes. Check the cron worker and environment variables.')::text as message
    from summary
    where summary.status = 'pending'
      and summary.oldest_created_at <= now() - interval '30 minutes'
  ), upserted as (
    insert into lck_private.notification_health_alert_state (
      alert_key,
      severity,
      message,
      last_seen_at
    )
    select
      current_alerts.alert_key,
      current_alerts.severity,
      current_alerts.message,
      now()
    from current_alerts
    on conflict (alert_key) do update
      set
        severity = excluded.severity,
        message = excluded.message,
        last_seen_at = now()
    returning
      notification_health_alert_state.alert_key,
      notification_health_alert_state.severity,
      notification_health_alert_state.message,
      notification_health_alert_state.last_sent_at,
      notification_health_alert_state.last_claimed_at
  )
  update lck_private.notification_health_alert_state alert_state
  set last_claimed_at = now()
  from upserted
  where alert_state.alert_key = upserted.alert_key
    and (
      upserted.last_sent_at is null
      or upserted.last_sent_at <= now() - interval '1 hour'
    )
    and (
      upserted.last_claimed_at is null
      or upserted.last_claimed_at <= now() - interval '10 minutes'
    )
  returning
    alert_state.alert_key,
    alert_state.severity,
    alert_state.message;
end;
$$;

revoke all on function lck_private.claim_notification_health_alerts()
  from public, anon, authenticated;
grant execute on function lck_private.claim_notification_health_alerts()
  to service_role;

drop function if exists lck_private.mark_notification_health_alert_sent(text);
create function lck_private.mark_notification_health_alert_sent(p_alert_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  affected_rows integer := 0;
begin
  update lck_private.notification_health_alert_state
  set last_sent_at = now()
  where alert_key = p_alert_key;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function lck_private.mark_notification_health_alert_sent(text)
  from public, anon, authenticated;
grant execute on function lck_private.mark_notification_health_alert_sent(text)
  to service_role;
