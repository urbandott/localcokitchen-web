drop function if exists lck_identity.list_admin_audit_events(text, text, integer, integer);
create function lck_identity.list_admin_audit_events(
  p_event_type text default null,
  p_target_type text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  event_source text,
  event_name text,
  actor_user_id uuid,
  target_type text,
  target_id uuid,
  severity text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_event_type text := nullif(btrim(coalesce(p_event_type, '')), '');
  safe_target_type text := nullif(btrim(coalesce(p_target_type, '')), '');
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  if safe_event_type is not null
    and safe_event_type not in ('admin_action', 'system_event') then
    raise exception using message = 'Invalid event source.', errcode = '22023';
  end if;

  if safe_target_type is not null
    and safe_target_type not in (
      'admin',
      'cook',
      'customer_order',
      'customer_order_item',
      'customer_payment_attempt',
      'payment_webhook_event'
    ) then
    raise exception using message = 'Invalid target type.', errcode = '22023';
  end if;

  return query
  with audit_events as (
    select
      'admin_action'::text as event_source,
      action as event_name,
      admin_actions.actor_user_id,
      admin_actions.target_type,
      admin_actions.target_id,
      'info'::text as severity,
      admin_actions.metadata - 'payload' - 'provider_reference' - 'token' - 'secret' as metadata,
      admin_actions.created_at
    from lck_private.admin_actions
    union all
    select
      'system_event'::text as event_source,
      system_events.event_name,
      system_events.actor_user_id,
      system_events.target_type,
      system_events.target_id,
      system_events.severity,
      system_events.metadata - 'payload' - 'provider_reference' - 'token' - 'secret' as metadata,
      system_events.created_at
    from lck_private.system_events
  )
  select
    audit_events.event_source,
    audit_events.event_name,
    audit_events.actor_user_id,
    audit_events.target_type,
    audit_events.target_id,
    audit_events.severity,
    audit_events.metadata,
    audit_events.created_at
  from audit_events
  where (safe_event_type is null or audit_events.event_source = safe_event_type)
    and (safe_target_type is null or audit_events.target_type = safe_target_type)
  order by audit_events.created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function lck_identity.list_admin_audit_events(text, text, integer, integer)
  from public, anon;
grant execute on function lck_identity.list_admin_audit_events(text, text, integer, integer)
  to authenticated;
