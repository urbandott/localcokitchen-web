create table if not exists lck_marketplace.customer_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references lck_identity.users(id) on delete restrict,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled', 'fulfilled', 'refunded')),
  subtotal_cents integer not null check (subtotal_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lck_marketplace.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references lck_marketplace.customer_orders(id) on delete cascade,
  menu_item_id uuid not null references lck_marketplace.cook_menu_items(id) on delete restrict,
  cook_id uuid not null references lck_marketplace.cook_profiles(cook_id) on delete restrict,
  item_name text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_cents integer not null check (line_total_cents > 0),
  created_at timestamptz not null default now(),
  constraint customer_order_items_line_total_matches
    check (line_total_cents = unit_price_cents * quantity)
);

create index if not exists customer_orders_customer_created_idx
  on lck_marketplace.customer_orders(customer_id, created_at desc);
create index if not exists customer_order_items_order_idx
  on lck_marketplace.customer_order_items(order_id);
create index if not exists customer_order_items_cook_created_idx
  on lck_marketplace.customer_order_items(cook_id, created_at desc);
create index if not exists customer_order_items_menu_item_idx
  on lck_marketplace.customer_order_items(menu_item_id);

drop trigger if exists set_customer_orders_updated_at
  on lck_marketplace.customer_orders;
create trigger set_customer_orders_updated_at
  before update on lck_marketplace.customer_orders
  for each row execute function lck_private.set_updated_at();

alter table lck_marketplace.customer_orders enable row level security;
alter table lck_marketplace.customer_order_items enable row level security;

drop policy if exists "Customers read their own orders" on lck_marketplace.customer_orders;
create policy "Customers read their own orders"
  on lck_marketplace.customer_orders
  for select
  to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "Admins manage customer orders" on lck_marketplace.customer_orders;
create policy "Admins manage customer orders"
  on lck_marketplace.customer_orders
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

drop policy if exists "Customers read their own order items" on lck_marketplace.customer_order_items;
create policy "Customers read their own order items"
  on lck_marketplace.customer_order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from lck_marketplace.customer_orders customer_order
      where customer_order.id = customer_order_items.order_id
        and customer_order.customer_id = (select auth.uid())
    )
  );

drop policy if exists "Cooks read their own order items" on lck_marketplace.customer_order_items;
create policy "Cooks read their own order items"
  on lck_marketplace.customer_order_items
  for select
  to authenticated
  using ((select auth.uid()) = cook_id);

drop policy if exists "Admins manage customer order items" on lck_marketplace.customer_order_items;
create policy "Admins manage customer order items"
  on lck_marketplace.customer_order_items
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

grant select on
  lck_marketplace.customer_orders,
  lck_marketplace.customer_order_items
to authenticated;

drop function if exists lck_marketplace.create_customer_checkout_order(jsonb);
create function lck_marketplace.create_customer_checkout_order(p_cart jsonb)
returns table (
  order_id uuid,
  subtotal_cents integer,
  item_count integer
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_marketplace, lck_identity
as $$
declare
  current_customer_id uuid := (select auth.uid());
  new_order_id uuid;
  computed_subtotal integer;
  computed_item_count integer;
  requested_count integer;
  matched_count integer;
begin
  if current_customer_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if jsonb_typeof(p_cart) <> 'array' then
    raise exception using message = 'Cart must be an array.', errcode = '22023';
  end if;

  create temporary table checkout_request (
    menu_item_id uuid primary key,
    quantity integer not null check (quantity between 1 and 10)
  ) on commit drop;

  insert into checkout_request (menu_item_id, quantity)
  select input.id, sum(input.quantity)::integer
  from jsonb_to_recordset(p_cart) as input(id uuid, quantity integer)
  group by input.id;

  get diagnostics requested_count = row_count;

  if requested_count < 1 or requested_count > 50 then
    raise exception using message = 'Cart must contain between 1 and 50 unique items.', errcode = '22023';
  end if;

  if exists (
    select 1
    from checkout_request request
    where request.quantity is null or request.quantity < 1 or request.quantity > 10
  ) then
    raise exception using message = 'Invalid item quantity.', errcode = '22023';
  end if;

  perform 1
  from lck_marketplace.cook_menu_items item
  join checkout_request request on request.menu_item_id = item.id
  for update of item;

  select count(*)
  into matched_count
  from checkout_request request
  join lck_marketplace.cook_menu_items item on item.id = request.menu_item_id
  join lck_marketplace.cook_profiles profile on profile.cook_id = item.cook_id
  join lck_marketplace.cook_applications application on application.user_id = item.cook_id
  where item.is_active
    and not item.is_sold_out
    and item.quantity_available >= request.quantity
    and profile.is_public
    and profile.moderator_disabled_at is null
    and application.status = 'approved';

  if matched_count <> requested_count then
    raise exception using message = 'One or more cart items are unavailable.', errcode = '23514';
  end if;

  select
    sum(item.price_cents * request.quantity)::integer,
    sum(request.quantity)::integer
  into computed_subtotal, computed_item_count
  from checkout_request request
  join lck_marketplace.cook_menu_items item on item.id = request.menu_item_id;

  if computed_subtotal is null or computed_subtotal <= 0 then
    raise exception using message = 'Invalid cart total.', errcode = '23514';
  end if;

  insert into lck_marketplace.customer_orders (customer_id, status, subtotal_cents, currency)
  values (current_customer_id, 'pending_payment', computed_subtotal, 'usd')
  returning id into new_order_id;

  insert into lck_marketplace.customer_order_items (
    order_id,
    menu_item_id,
    cook_id,
    item_name,
    unit_price_cents,
    quantity,
    line_total_cents
  )
  select
    new_order_id,
    item.id,
    item.cook_id,
    item.name,
    item.price_cents,
    request.quantity,
    item.price_cents * request.quantity
  from checkout_request request
  join lck_marketplace.cook_menu_items item on item.id = request.menu_item_id;

  update lck_marketplace.cook_menu_items item
  set
    quantity_available = item.quantity_available - request.quantity,
    is_sold_out = (item.quantity_available - request.quantity) <= 0
  from checkout_request request
  where item.id = request.menu_item_id;

  return query select new_order_id, computed_subtotal, computed_item_count;
end;
$$;

revoke all on function lck_marketplace.create_customer_checkout_order(jsonb)
  from public, anon;
grant execute on function lck_marketplace.create_customer_checkout_order(jsonb)
  to authenticated;
