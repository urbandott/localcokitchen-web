alter table lck_marketplace.customer_orders
  add column if not exists expires_at timestamptz not null default (now() + interval '15 minutes'),
  add column if not exists paid_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create table if not exists lck_marketplace.customer_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references lck_marketplace.customer_orders(id) on delete cascade,
  customer_id uuid not null references lck_identity.users(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'manual', 'test')),
  provider_reference text not null,
  status text not null default 'created'
    check (status in ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'expired')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  last_event_id text,
  last_event_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table if not exists lck_private.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'manual', 'test')),
  provider_event_id text not null,
  event_type text not null,
  provider_reference text,
  order_id uuid,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists customer_payment_attempts_order_idx
  on lck_marketplace.customer_payment_attempts(order_id, created_at desc);
create index if not exists customer_payment_attempts_customer_idx
  on lck_marketplace.customer_payment_attempts(customer_id, created_at desc);
create index if not exists customer_orders_pending_expiry_idx
  on lck_marketplace.customer_orders(expires_at)
  where status = 'pending_payment';

drop trigger if exists set_customer_payment_attempts_updated_at
  on lck_marketplace.customer_payment_attempts;
create trigger set_customer_payment_attempts_updated_at
  before update on lck_marketplace.customer_payment_attempts
  for each row execute function lck_private.set_updated_at();

alter table lck_marketplace.customer_payment_attempts enable row level security;
alter table lck_private.payment_webhook_events enable row level security;

drop policy if exists "Customers read their own payment attempts"
  on lck_marketplace.customer_payment_attempts;
create policy "Customers read their own payment attempts"
  on lck_marketplace.customer_payment_attempts
  for select
  to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "Admins manage payment attempts"
  on lck_marketplace.customer_payment_attempts;
create policy "Admins manage payment attempts"
  on lck_marketplace.customer_payment_attempts
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

grant select on lck_marketplace.customer_payment_attempts to authenticated;

create or replace function lck_private.cancel_customer_order_and_restock(
  p_order_id uuid,
  p_cancelled_at timestamptz default now()
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace
as $$
declare
  affected_rows integer := 0;
begin
  update lck_marketplace.customer_orders customer_order
  set
    status = 'cancelled',
    cancelled_at = coalesce(customer_order.cancelled_at, p_cancelled_at)
  where customer_order.id = p_order_id
    and customer_order.status = 'pending_payment';

  get diagnostics affected_rows = row_count;

  if affected_rows > 0 then
    update lck_marketplace.cook_menu_items item
    set
      quantity_available = least(10000, item.quantity_available + order_item.quantity),
      is_sold_out = false
    from lck_marketplace.customer_order_items order_item
    where order_item.order_id = p_order_id
      and order_item.menu_item_id = item.id;
  end if;

  return affected_rows > 0;
end;
$$;

revoke all on function lck_private.cancel_customer_order_and_restock(uuid, timestamptz)
  from public, anon, authenticated;

drop function if exists lck_marketplace.record_payment_webhook_event(
  text, text, text, text, text, uuid, integer, text, jsonb
);
create function lck_marketplace.record_payment_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_reference text,
  p_payment_status text,
  p_order_id uuid default null,
  p_amount_cents integer default null,
  p_currency text default 'usd',
  p_payload jsonb default '{}'::jsonb
)
returns table (
  order_id uuid,
  order_status text,
  payment_status text,
  processed boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace, lck_private
as $$
declare
  inserted_rows integer := 0;
  target_order lck_marketplace.customer_orders%rowtype;
  target_attempt lck_marketplace.customer_payment_attempts%rowtype;
begin
  if p_provider not in ('stripe', 'manual', 'test') then
    raise exception using message = 'Unsupported payment provider.', errcode = '22023';
  end if;
  if p_provider_event_id is null or btrim(p_provider_event_id) = '' then
    raise exception using message = 'Provider event id is required.', errcode = '22023';
  end if;
  if p_provider_reference is null or btrim(p_provider_reference) = '' then
    raise exception using message = 'Provider payment reference is required.', errcode = '22023';
  end if;
  if p_payment_status not in ('succeeded', 'failed', 'canceled', 'expired', 'processing', 'requires_action') then
    raise exception using message = 'Unsupported payment status.', errcode = '22023';
  end if;

  insert into lck_private.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    provider_reference,
    order_id,
    payload
  )
  values (
    p_provider,
    p_provider_event_id,
    p_event_type,
    p_provider_reference,
    p_order_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics inserted_rows = row_count;

  select *
  into target_attempt
  from lck_marketplace.customer_payment_attempts attempt
  where attempt.provider = p_provider
    and attempt.provider_reference = p_provider_reference
  for update;

  if target_attempt.id is null then
    if p_order_id is null then
      return query select null::uuid, null::text, p_payment_status, inserted_rows > 0;
      return;
    end if;

    select *
    into target_order
    from lck_marketplace.customer_orders customer_order
    where customer_order.id = p_order_id
    for update;

    if target_order.id is null then
      raise exception using message = 'Order not found for payment event.', errcode = 'P0002';
    end if;
    if target_order.status <> 'pending_payment' then
      return query select target_order.id, target_order.status, p_payment_status, inserted_rows > 0;
      return;
    end if;
    if p_amount_cents is null or p_amount_cents <> target_order.subtotal_cents then
      raise exception using message = 'Payment amount does not match order total.', errcode = '23514';
    end if;
    if lower(coalesce(p_currency, '')) <> target_order.currency then
      raise exception using message = 'Payment currency does not match order currency.', errcode = '23514';
    end if;

    insert into lck_marketplace.customer_payment_attempts (
      order_id,
      customer_id,
      provider,
      provider_reference,
      status,
      amount_cents,
      currency,
      last_event_id,
      last_event_type
    )
    values (
      target_order.id,
      target_order.customer_id,
      p_provider,
      p_provider_reference,
      p_payment_status,
      p_amount_cents,
      target_order.currency,
      p_provider_event_id,
      p_event_type
    )
    returning * into target_attempt;
  else
    update lck_marketplace.customer_payment_attempts attempt
    set
      status = p_payment_status,
      last_event_id = p_provider_event_id,
      last_event_type = p_event_type
    where attempt.id = target_attempt.id
    returning * into target_attempt;

    select *
    into target_order
    from lck_marketplace.customer_orders customer_order
    where customer_order.id = target_attempt.order_id
    for update;

    if p_amount_cents is not null and p_amount_cents <> target_attempt.amount_cents then
      raise exception using message = 'Payment amount does not match payment attempt.', errcode = '23514';
    end if;
    if lower(coalesce(p_currency, target_attempt.currency)) <> target_attempt.currency then
      raise exception using message = 'Payment currency does not match payment attempt.', errcode = '23514';
    end if;
  end if;

  if p_payment_status = 'succeeded' then
    update lck_marketplace.customer_orders customer_order
    set
      status = 'paid',
      paid_at = coalesce(customer_order.paid_at, now())
    where customer_order.id = target_attempt.order_id
      and customer_order.status = 'pending_payment'
    returning * into target_order;
  elsif p_payment_status in ('canceled', 'expired') then
    perform lck_private.cancel_customer_order_and_restock(target_attempt.order_id, now());
    select *
    into target_order
    from lck_marketplace.customer_orders customer_order
    where customer_order.id = target_attempt.order_id;
  else
    select *
    into target_order
    from lck_marketplace.customer_orders customer_order
    where customer_order.id = target_attempt.order_id;
  end if;

  return query select target_attempt.order_id, target_order.status, target_attempt.status, inserted_rows > 0;
end;
$$;

revoke all on function lck_marketplace.record_payment_webhook_event(
  text, text, text, text, text, uuid, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function lck_marketplace.record_payment_webhook_event(
  text, text, text, text, text, uuid, integer, text, jsonb
) to service_role;

drop function if exists lck_marketplace.expire_pending_payment_orders(timestamptz);
create function lck_marketplace.expire_pending_payment_orders(
  p_before timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace, lck_private
as $$
declare
  expired_count integer := 0;
  order_record record;
begin
  for order_record in
    select id
    from lck_marketplace.customer_orders
    where status = 'pending_payment'
      and expires_at <= p_before
    for update
  loop
    if lck_private.cancel_customer_order_and_restock(order_record.id, p_before) then
      expired_count := expired_count + 1;
    end if;
  end loop;

  update lck_marketplace.customer_payment_attempts attempt
  set status = 'expired'
  where attempt.status in ('created', 'requires_action', 'processing')
    and exists (
      select 1
      from lck_marketplace.customer_orders customer_order
      where customer_order.id = attempt.order_id
        and customer_order.status = 'cancelled'
        and customer_order.cancelled_at = p_before
    );

  return expired_count;
end;
$$;

revoke all on function lck_marketplace.expire_pending_payment_orders(timestamptz)
  from public, anon, authenticated;
grant execute on function lck_marketplace.expire_pending_payment_orders(timestamptz)
  to service_role;
