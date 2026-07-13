create table if not exists lck_private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null check (char_length(notification_type) between 3 and 120),
  recipient_user_id uuid references lck_identity.users(id) on delete set null,
  recipient_email text not null check (position('@' in recipient_email) > 1 and char_length(recipient_email) <= 320),
  channel text not null default 'email' check (channel in ('email')),
  template_key text not null check (char_length(template_key) between 3 and 120),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_outbox_pending_idx
  on lck_private.notification_outbox(status, next_attempt_at, created_at)
  where status = 'pending';
create index if not exists notification_outbox_recipient_created_idx
  on lck_private.notification_outbox(recipient_user_id, created_at desc);
create index if not exists notification_outbox_target_created_idx
  on lck_private.notification_outbox(target_type, target_id, created_at desc);

drop trigger if exists set_notification_outbox_updated_at
  on lck_private.notification_outbox;
create trigger set_notification_outbox_updated_at
  before update on lck_private.notification_outbox
  for each row execute function lck_private.set_updated_at();

alter table lck_private.notification_outbox enable row level security;
revoke all on table lck_private.notification_outbox
  from public, anon, authenticated;

create or replace function lck_private.enqueue_notification(
  p_notification_type text,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_template_key text,
  p_target_type text,
  p_target_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  new_notification_id uuid;
begin
  if p_recipient_email is null or position('@' in p_recipient_email) <= 1 then
    return null;
  end if;

  insert into lck_private.notification_outbox (
    notification_type,
    recipient_user_id,
    recipient_email,
    template_key,
    target_type,
    target_id,
    payload
  )
  values (
    p_notification_type,
    p_recipient_user_id,
    lower(btrim(p_recipient_email)),
    p_template_key,
    p_target_type,
    p_target_id,
    coalesce(p_payload, '{}'::jsonb) - 'payload' - 'provider_reference' - 'token' - 'secret'
  )
  returning id into new_notification_id;

  return new_notification_id;
end;
$$;

revoke all on function lck_private.enqueue_notification(text, uuid, text, text, text, uuid, jsonb)
  from public, anon, authenticated;

create or replace function lck_private.enqueue_order_status_notifications()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private, lck_identity, lck_marketplace
as $$
declare
  customer_email text;
  cook_record record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select email into customer_email
  from lck_identity.users
  where id = new.customer_id;

  if new.status = 'paid' then
    perform lck_private.enqueue_notification(
      'order.payment_confirmed',
      new.customer_id,
      customer_email,
      'customer_order_payment_confirmed',
      'customer_order',
      new.id,
      jsonb_build_object(
        'order_id', new.id,
        'subtotal_cents', new.subtotal_cents,
        'currency', new.currency
      )
    );

    for cook_record in
      select distinct
        order_item.cook_id,
        cook_user.email
      from lck_marketplace.customer_order_items order_item
      join lck_identity.users cook_user
        on cook_user.id = order_item.cook_id
      where order_item.order_id = new.id
    loop
      perform lck_private.enqueue_notification(
        'cook.order_paid',
        cook_record.cook_id,
        cook_record.email,
        'cook_order_paid',
        'customer_order',
        new.id,
        jsonb_build_object('order_id', new.id)
      );
    end loop;
  elsif new.status in ('cancelled', 'refunded') then
    perform lck_private.enqueue_notification(
      'order.' || new.status,
      new.customer_id,
      customer_email,
      'customer_order_' || new.status,
      'customer_order',
      new.id,
      jsonb_build_object('order_id', new.id, 'previous_status', old.status)
    );
  elsif new.status = 'fulfilled' then
    perform lck_private.enqueue_notification(
      'order.fulfilled',
      new.customer_id,
      customer_email,
      'customer_order_fulfilled',
      'customer_order',
      new.id,
      jsonb_build_object('order_id', new.id)
    );
  end if;

  return new;
end;
$$;

revoke all on function lck_private.enqueue_order_status_notifications()
  from public, anon, authenticated;
drop trigger if exists enqueue_order_status_notifications
  on lck_marketplace.customer_orders;
create trigger enqueue_order_status_notifications
  after update of status on lck_marketplace.customer_orders
  for each row execute function lck_private.enqueue_order_status_notifications();

create or replace function lck_private.enqueue_order_item_fulfillment_notifications()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private, lck_identity, lck_marketplace
as $$
declare
  customer_id uuid;
  customer_email text;
begin
  if new.fulfillment_status is not distinct from old.fulfillment_status then
    return new;
  end if;
  if new.fulfillment_status not in ('ready', 'fulfilled') then
    return new;
  end if;

  select customer_order.customer_id, customer_user.email
  into customer_id, customer_email
  from lck_marketplace.customer_orders customer_order
  join lck_identity.users customer_user
    on customer_user.id = customer_order.customer_id
  where customer_order.id = new.order_id
    and customer_order.status in ('paid', 'fulfilled');

  perform lck_private.enqueue_notification(
    'order_item.' || new.fulfillment_status,
    customer_id,
    customer_email,
    'customer_order_item_' || new.fulfillment_status,
    'customer_order_item',
    new.id,
    jsonb_build_object(
      'order_id', new.order_id,
      'item_name', new.item_name,
      'quantity', new.quantity
    )
  );

  return new;
end;
$$;

revoke all on function lck_private.enqueue_order_item_fulfillment_notifications()
  from public, anon, authenticated;
drop trigger if exists enqueue_order_item_fulfillment_notifications
  on lck_marketplace.customer_order_items;
create trigger enqueue_order_item_fulfillment_notifications
  after update of fulfillment_status on lck_marketplace.customer_order_items
  for each row execute function lck_private.enqueue_order_item_fulfillment_notifications();

drop function if exists lck_private.claim_pending_notifications(integer);
create function lck_private.claim_pending_notifications(p_limit integer default 25)
returns setof lck_private.notification_outbox
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  return query
  update lck_private.notification_outbox notification
  set
    status = 'processing',
    attempts = notification.attempts + 1
  where notification.id in (
    select candidate.id
    from lck_private.notification_outbox candidate
    where candidate.status = 'pending'
      and candidate.next_attempt_at <= now()
    order by candidate.created_at
    for update skip locked
    limit safe_limit
  )
  returning notification.*;
end;
$$;

revoke all on function lck_private.claim_pending_notifications(integer)
  from public, anon, authenticated;
grant execute on function lck_private.claim_pending_notifications(integer)
  to service_role;

drop function if exists lck_private.mark_notification_sent(uuid);
create function lck_private.mark_notification_sent(p_notification_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  affected_rows integer := 0;
begin
  update lck_private.notification_outbox
  set
    status = 'sent',
    sent_at = now(),
    last_error = null
  where id = p_notification_id
    and status = 'processing';

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function lck_private.mark_notification_sent(uuid)
  from public, anon, authenticated;
grant execute on function lck_private.mark_notification_sent(uuid)
  to service_role;

drop function if exists lck_private.mark_notification_failed(uuid, text);
create function lck_private.mark_notification_failed(
  p_notification_id uuid,
  p_error text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  affected_rows integer := 0;
begin
  update lck_private.notification_outbox notification
  set
    status = case when notification.attempts >= 5 then 'failed' else 'pending' end,
    next_attempt_at = now() + (interval '5 minutes' * greatest(notification.attempts, 1)),
    last_error = left(coalesce(p_error, 'Unknown notification failure.'), 1000)
  where notification.id = p_notification_id
    and notification.status = 'processing';

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function lck_private.mark_notification_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function lck_private.mark_notification_failed(uuid, text)
  to service_role;
