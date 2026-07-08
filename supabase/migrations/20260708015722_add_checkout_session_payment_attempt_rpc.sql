drop function if exists lck_marketplace.create_checkout_session_payment_attempt(
  uuid, text, integer, text
);
create function lck_marketplace.create_checkout_session_payment_attempt(
  p_order_id uuid,
  p_provider_reference text,
  p_amount_cents integer,
  p_currency text default 'usd'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace
as $$
declare
  current_customer_id uuid := (select auth.uid());
  target_order lck_marketplace.customer_orders%rowtype;
  payment_attempt_id uuid;
begin
  if current_customer_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;
  if p_provider_reference is null or btrim(p_provider_reference) = '' then
    raise exception using message = 'Provider reference is required.', errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using message = 'Payment amount is invalid.', errcode = '22023';
  end if;
  if lower(coalesce(p_currency, '')) <> 'usd' then
    raise exception using message = 'Payment currency is invalid.', errcode = '22023';
  end if;

  select *
  into target_order
  from lck_marketplace.customer_orders customer_order
  where customer_order.id = p_order_id
    and customer_order.customer_id = current_customer_id
  for update;

  if target_order.id is null then
    raise exception using message = 'Order not found.', errcode = 'P0002';
  end if;
  if target_order.status <> 'pending_payment' then
    raise exception using message = 'Order is not awaiting payment.', errcode = '23514';
  end if;
  if target_order.expires_at <= now() then
    raise exception using message = 'Order payment window has expired.', errcode = '23514';
  end if;
  if target_order.subtotal_cents <> p_amount_cents then
    raise exception using message = 'Payment amount does not match order total.', errcode = '23514';
  end if;
  if target_order.currency <> lower(p_currency) then
    raise exception using message = 'Payment currency does not match order currency.', errcode = '23514';
  end if;

  insert into lck_marketplace.customer_payment_attempts (
    order_id,
    customer_id,
    provider,
    provider_reference,
    status,
    amount_cents,
    currency
  )
  values (
    target_order.id,
    target_order.customer_id,
    'stripe',
    p_provider_reference,
    'created',
    target_order.subtotal_cents,
    target_order.currency
  )
  on conflict (provider, provider_reference) do update
    set updated_at = now()
    where customer_payment_attempts.order_id = target_order.id
      and customer_payment_attempts.customer_id = current_customer_id
      and customer_payment_attempts.status in ('created', 'requires_action', 'processing')
  returning id into payment_attempt_id;

  if payment_attempt_id is null then
    raise exception using message = 'Payment attempt could not be created.', errcode = '23505';
  end if;

  return payment_attempt_id;
end;
$$;

revoke all on function lck_marketplace.create_checkout_session_payment_attempt(
  uuid, text, integer, text
) from public, anon;
grant execute on function lck_marketplace.create_checkout_session_payment_attempt(
  uuid, text, integer, text
) to authenticated;
