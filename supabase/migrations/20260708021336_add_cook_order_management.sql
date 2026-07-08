alter table lck_marketplace.customer_order_items
  add column if not exists fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'ready', 'fulfilled')),
  add column if not exists fulfilled_at timestamptz;

create index if not exists customer_order_items_cook_fulfillment_idx
  on lck_marketplace.customer_order_items(cook_id, fulfillment_status, created_at desc);

drop policy if exists "Cooks read their own order items" on lck_marketplace.customer_order_items;
create policy "Cooks read paid own order items"
  on lck_marketplace.customer_order_items
  for select
  to authenticated
  using (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.customer_orders customer_order
      where customer_order.id = customer_order_items.order_id
        and customer_order.status in ('paid', 'fulfilled', 'refunded')
    )
  );

drop function if exists lck_marketplace.list_own_cook_order_items();
create function lck_marketplace.list_own_cook_order_items()
returns table (
  order_item_id uuid,
  order_id uuid,
  menu_item_id uuid,
  item_name text,
  quantity integer,
  unit_price_cents integer,
  line_total_cents integer,
  fulfillment_status text,
  fulfilled_at timestamptz,
  order_status text,
  order_paid_at timestamptz,
  order_created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, lck_marketplace
as $$
  select
    order_item.id as order_item_id,
    order_item.order_id,
    order_item.menu_item_id,
    order_item.item_name,
    order_item.quantity,
    order_item.unit_price_cents,
    order_item.line_total_cents,
    order_item.fulfillment_status,
    order_item.fulfilled_at,
    customer_order.status as order_status,
    customer_order.paid_at as order_paid_at,
    customer_order.created_at as order_created_at
  from lck_marketplace.customer_order_items order_item
  join lck_marketplace.customer_orders customer_order
    on customer_order.id = order_item.order_id
  join lck_marketplace.cook_applications application
    on application.user_id = order_item.cook_id
  where order_item.cook_id = (select auth.uid())
    and application.status = 'approved'
    and customer_order.status in ('paid', 'fulfilled', 'refunded')
  order by customer_order.paid_at desc nulls last, customer_order.created_at desc, order_item.created_at asc
  limit 100;
$$;

revoke all on function lck_marketplace.list_own_cook_order_items()
  from public, anon;
grant execute on function lck_marketplace.list_own_cook_order_items()
  to authenticated;

drop function if exists lck_marketplace.update_own_cook_order_item_fulfillment(uuid, text);
create function lck_marketplace.update_own_cook_order_item_fulfillment(
  p_order_item_id uuid,
  p_fulfillment_status text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace
as $$
declare
  current_cook_id uuid := (select auth.uid());
  target_item lck_marketplace.customer_order_items%rowtype;
  target_order lck_marketplace.customer_orders%rowtype;
  pending_item_count integer := 0;
begin
  if current_cook_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;
  if p_fulfillment_status not in ('ready', 'fulfilled') then
    raise exception using message = 'Unsupported fulfillment status.', errcode = '22023';
  end if;
  if not exists (
    select 1
    from lck_marketplace.cook_applications application
    where application.user_id = current_cook_id
      and application.status = 'approved'
  ) then
    raise exception using message = 'Approved cook access required.', errcode = '42501';
  end if;

  select *
  into target_item
  from lck_marketplace.customer_order_items order_item
  where order_item.id = p_order_item_id
    and order_item.cook_id = current_cook_id
  for update;

  if target_item.id is null then
    raise exception using message = 'Order item not found.', errcode = 'P0002';
  end if;

  select *
  into target_order
  from lck_marketplace.customer_orders customer_order
  where customer_order.id = target_item.order_id
  for update;

  if target_order.status <> 'paid' then
    raise exception using message = 'Only paid orders can be updated by cooks.', errcode = '23514';
  end if;

  update lck_marketplace.customer_order_items order_item
  set
    fulfillment_status = p_fulfillment_status,
    fulfilled_at = case
      when p_fulfillment_status = 'fulfilled' then coalesce(order_item.fulfilled_at, now())
      else null
    end
  where order_item.id = target_item.id;

  select count(*)
  into pending_item_count
  from lck_marketplace.customer_order_items order_item
  where order_item.order_id = target_item.order_id
    and order_item.fulfillment_status <> 'fulfilled';

  if pending_item_count = 0 then
    update lck_marketplace.customer_orders customer_order
    set status = 'fulfilled'
    where customer_order.id = target_item.order_id
      and customer_order.status = 'paid';
  end if;

  return true;
end;
$$;

revoke all on function lck_marketplace.update_own_cook_order_item_fulfillment(uuid, text)
  from public, anon;
grant execute on function lck_marketplace.update_own_cook_order_item_fulfillment(uuid, text)
  to authenticated;
