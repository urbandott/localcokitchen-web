drop function if exists lck_identity.get_admin_notification_summary();
create function lck_identity.get_admin_notification_summary()
returns table (
  status text,
  total_count bigint,
  oldest_created_at timestamptz,
  newest_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, lck_identity, lck_private
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  return query
  select
    notification.status,
    count(*)::bigint as total_count,
    min(notification.created_at) as oldest_created_at,
    max(notification.created_at) as newest_created_at
  from lck_private.notification_outbox notification
  group by notification.status
  order by notification.status;
end;
$$;

revoke all on function lck_identity.get_admin_notification_summary()
  from public, anon;
grant execute on function lck_identity.get_admin_notification_summary()
  to authenticated;

drop function if exists lck_identity.list_admin_notifications(text, integer, integer);
create function lck_identity.list_admin_notifications(
  p_status text default 'all',
  p_limit integer default 75,
  p_offset integer default 0
)
returns table (
  notification_id uuid,
  notification_type text,
  recipient_email_masked text,
  channel text,
  template_key text,
  target_type text,
  target_id uuid,
  status text,
  attempts integer,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, lck_identity, lck_private
as $$
declare
  safe_status text := lower(nullif(btrim(coalesce(p_status, 'all')), ''));
  safe_limit integer := least(greatest(coalesce(p_limit, 75), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  if safe_status is null then
    safe_status := 'all';
  end if;

  if safe_status not in ('all', 'pending', 'processing', 'sent', 'failed', 'cancelled') then
    raise exception using message = 'Invalid notification status filter.', errcode = '22023';
  end if;

  return query
  with filtered as (
    select notification.*
    from lck_private.notification_outbox notification
    where safe_status = 'all' or notification.status = safe_status
  )
  select
    filtered.id as notification_id,
    filtered.notification_type,
    case
      when position('@' in filtered.recipient_email) > 1 then
        left(split_part(filtered.recipient_email, '@', 1), 2)
        || '***@'
        || split_part(filtered.recipient_email, '@', 2)
      else 'hidden'
    end as recipient_email_masked,
    filtered.channel,
    filtered.template_key,
    filtered.target_type,
    filtered.target_id,
    filtered.status,
    filtered.attempts,
    filtered.next_attempt_at,
    filtered.sent_at,
    left(coalesce(filtered.last_error, ''), 500) as last_error,
    filtered.created_at,
    filtered.updated_at,
    count(*) over ()::bigint as total_count
  from filtered
  order by filtered.created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function lck_identity.list_admin_notifications(text, integer, integer)
  from public, anon;
grant execute on function lck_identity.list_admin_notifications(text, integer, integer)
  to authenticated;

drop function if exists lck_identity.retry_admin_notification(uuid);
create function lck_identity.retry_admin_notification(p_notification_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_identity, lck_private
as $$
declare
  affected_rows integer := 0;
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  update lck_private.notification_outbox
  set
    status = 'pending',
    next_attempt_at = now(),
    last_error = null
  where id = p_notification_id
    and status in ('pending', 'failed');

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function lck_identity.retry_admin_notification(uuid)
  from public, anon;
grant execute on function lck_identity.retry_admin_notification(uuid)
  to authenticated;
