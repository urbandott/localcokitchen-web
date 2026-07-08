drop function if exists lck_marketplace.cancel_own_pending_payment_order(uuid);
create function lck_marketplace.cancel_own_pending_payment_order(p_order_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace, lck_private
as $$
declare
  current_customer_id uuid := (select auth.uid());
  target_order lck_marketplace.customer_orders%rowtype;
  cancelled boolean := false;
begin
  if current_customer_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
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
    raise exception using message = 'Only pending payment orders can be cancelled.', errcode = '23514';
  end if;

  cancelled := lck_private.cancel_customer_order_and_restock(target_order.id, now());

  update lck_marketplace.customer_payment_attempts attempt
  set status = 'canceled'
  where attempt.order_id = target_order.id
    and attempt.customer_id = current_customer_id
    and attempt.status in ('created', 'requires_action', 'processing');

  return cancelled;
end;
$$;

revoke all on function lck_marketplace.cancel_own_pending_payment_order(uuid)
  from public, anon;
grant execute on function lck_marketplace.cancel_own_pending_payment_order(uuid)
  to authenticated;
