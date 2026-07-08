create index if not exists system_events_actor_created_idx
  on lck_private.system_events(actor_user_id, created_at desc);

create or replace function lck_private.record_system_event(
  p_event_name text,
  p_actor_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_severity text default 'info',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  if p_event_name is null or char_length(p_event_name) < 3 or char_length(p_event_name) > 120 then
    raise exception using message = 'Invalid event name.', errcode = '22023';
  end if;
  if p_target_type is null or char_length(p_target_type) < 2 or char_length(p_target_type) > 80 then
    raise exception using message = 'Invalid target type.', errcode = '22023';
  end if;
  if p_severity not in ('info', 'warning', 'critical') then
    raise exception using message = 'Invalid event severity.', errcode = '22023';
  end if;

  insert into lck_private.system_events (
    event_name,
    actor_user_id,
    target_type,
    target_id,
    severity,
    metadata
  )
  values (
    p_event_name,
    p_actor_user_id,
    p_target_type,
    p_target_id,
    p_severity,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function lck_private.record_system_event(text, uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

create or replace function lck_private.audit_customer_order_status()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  event_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  event_name := 'order.' || new.status;
  perform lck_private.record_system_event(
    event_name,
    coalesce((select auth.uid()), new.customer_id),
    'customer_order',
    new.id,
    case
      when new.status in ('cancelled', 'refunded') then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'previous_status', old.status,
      'customer_id', new.customer_id,
      'subtotal_cents', new.subtotal_cents,
      'currency', new.currency
    )
  );

  return new;
end;
$$;

revoke all on function lck_private.audit_customer_order_status()
  from public, anon, authenticated;
drop trigger if exists audit_customer_order_status
  on lck_marketplace.customer_orders;
create trigger audit_customer_order_status
  after update of status on lck_marketplace.customer_orders
  for each row execute function lck_private.audit_customer_order_status();

create or replace function lck_private.audit_order_item_fulfillment()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  if new.fulfillment_status is not distinct from old.fulfillment_status then
    return new;
  end if;

  perform lck_private.record_system_event(
    'order_item.' || new.fulfillment_status,
    coalesce((select auth.uid()), new.cook_id),
    'customer_order_item',
    new.id,
    'info',
    jsonb_build_object(
      'order_id', new.order_id,
      'cook_id', new.cook_id,
      'previous_fulfillment_status', old.fulfillment_status
    )
  );

  return new;
end;
$$;

revoke all on function lck_private.audit_order_item_fulfillment()
  from public, anon, authenticated;
drop trigger if exists audit_order_item_fulfillment
  on lck_marketplace.customer_order_items;
create trigger audit_order_item_fulfillment
  after update of fulfillment_status on lck_marketplace.customer_order_items
  for each row execute function lck_private.audit_order_item_fulfillment();

create or replace function lck_private.audit_payment_attempt_status()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  perform lck_private.record_system_event(
    'payment.' || new.status,
    new.customer_id,
    'customer_payment_attempt',
    new.id,
    case
      when new.status in ('failed', 'canceled', 'expired') then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'order_id', new.order_id,
      'provider', new.provider,
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
      'amount_cents', new.amount_cents,
      'currency', new.currency,
      'last_event_type', new.last_event_type
    )
  );

  return new;
end;
$$;

revoke all on function lck_private.audit_payment_attempt_status()
  from public, anon, authenticated;
drop trigger if exists audit_payment_attempt_status
  on lck_marketplace.customer_payment_attempts;
create trigger audit_payment_attempt_status
  after update of status on lck_marketplace.customer_payment_attempts
  for each row execute function lck_private.audit_payment_attempt_status();

drop trigger if exists audit_payment_attempt_insert
  on lck_marketplace.customer_payment_attempts;
create trigger audit_payment_attempt_insert
  after insert on lck_marketplace.customer_payment_attempts
  for each row execute function lck_private.audit_payment_attempt_status();

create or replace function lck_private.audit_payment_webhook_event()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  perform lck_private.record_system_event(
    'payment.webhook_received',
    null,
    'payment_webhook_event',
    new.id,
    'info',
    jsonb_build_object(
      'provider', new.provider,
      'event_type', new.event_type,
      'order_id', new.order_id
    )
  );

  return new;
end;
$$;

revoke all on function lck_private.audit_payment_webhook_event()
  from public, anon, authenticated;
drop trigger if exists audit_payment_webhook_event
  on lck_private.payment_webhook_events;
create trigger audit_payment_webhook_event
  after insert on lck_private.payment_webhook_events
  for each row execute function lck_private.audit_payment_webhook_event();
