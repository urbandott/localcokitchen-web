drop policy if exists "Admins read all cook pickup windows"
  on lck_marketplace.cook_pickup_windows;
create policy "Admins read all cook pickup windows"
  on lck_marketplace.cook_pickup_windows
  for select
  to authenticated
  using ((select lck_identity.current_user_is_admin()));

drop policy if exists "Admins read all cook menu items"
  on lck_marketplace.cook_menu_items;
create policy "Admins read all cook menu items"
  on lck_marketplace.cook_menu_items
  for select
  to authenticated
  using ((select lck_identity.current_user_is_admin()));

create or replace function lck_identity.list_admin_cooks(
  p_search text default '',
  p_application_status text default 'all',
  p_kitchen_visibility text default 'all',
  p_account_state text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  cook_id uuid,
  email text,
  full_name text,
  legal_name text,
  display_name text,
  phone text,
  pickup_zip_code text,
  application_status text,
  is_live_kitchen boolean,
  is_active_cook boolean,
  cuisine_type text,
  menu_item_count bigint,
  active_pickup_window_count bigint,
  submitted_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, lck_identity, lck_marketplace
as $$
declare
  search_term text := left(lower(btrim(coalesce(p_search, ''))), 100);
  result_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  result_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  if p_application_status not in ('all', 'draft', 'submitted', 'approved', 'rejected', 'suspended')
    or p_kitchen_visibility not in ('all', 'live', 'not_live')
    or p_account_state not in ('all', 'active', 'inactive') then
    raise exception using message = 'Invalid cook directory filter.', errcode = '22023';
  end if;

  return query
  with cooks as (
    select
      application.user_id as cook_id,
      account.email,
      account.full_name,
      application.legal_name,
      profile.display_name,
      application.phone,
      application.pickup_zip_code,
      application.status as application_status,
      application.status = 'approved' and coalesce(profile.is_public, false) as is_live_kitchen,
      exists (
        select 1
        from lck_identity.user_roles cook_role
        where cook_role.user_id = application.user_id
          and cook_role.role = 'cook'
          and cook_role.revoked_at is null
      ) as is_active_cook,
      profile.cuisine_type,
      (select count(*) from lck_marketplace.cook_menu_items item
        where item.cook_id = application.user_id) as menu_item_count,
      (select count(*) from lck_marketplace.cook_pickup_windows pickup
        where pickup.cook_id = application.user_id and pickup.is_active) as active_pickup_window_count,
      application.submitted_at
    from lck_marketplace.cook_applications application
    join lck_identity.users account on account.id = application.user_id
    left join lck_marketplace.cook_profiles profile on profile.cook_id = application.user_id
  ), filtered as (
    select cooks.*
    from cooks
    where (
      search_term = ''
      or lower(coalesce(cooks.email, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.full_name, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.legal_name, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.display_name, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.phone, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.pickup_zip_code, '')) like '%' || search_term || '%'
      or lower(coalesce(cooks.cuisine_type, '')) like '%' || search_term || '%'
    )
      and (p_application_status = 'all' or cooks.application_status = p_application_status)
      and (p_kitchen_visibility = 'all'
        or (p_kitchen_visibility = 'live' and cooks.is_live_kitchen)
        or (p_kitchen_visibility = 'not_live' and not cooks.is_live_kitchen))
      and (p_account_state = 'all'
        or (p_account_state = 'active' and cooks.is_active_cook)
        or (p_account_state = 'inactive' and not cooks.is_active_cook))
  )
  select filtered.*, count(*) over () as total_count
  from filtered
  order by filtered.submitted_at desc, filtered.cook_id
  limit result_limit
  offset result_offset;
end;
$$;

create or replace function lck_identity.get_admin_cook_detail(p_cook_id uuid)
returns table (
  cook_id uuid,
  email text,
  first_name text,
  last_name text,
  full_name text,
  account_created_at timestamptz,
  legal_name text,
  phone text,
  pickup_address text,
  pickup_zip_code text,
  food_handler_training_completed boolean,
  food_handler_certificate_url text,
  permit_or_certification_url text,
  application_status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  display_name text,
  profile_image_url text,
  description text,
  cuisine_type text,
  preorder_cutoff_hours integer,
  order_notes text,
  is_public boolean,
  rating numeric,
  review_count integer,
  membership_tier text,
  menu_item_limit integer,
  is_active_cook boolean,
  menu_items jsonb,
  pickup_windows jsonb
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, lck_identity, lck_marketplace
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  return query
  select
    application.user_id,
    account.email,
    account.first_name,
    account.last_name,
    account.full_name,
    account.created_at,
    application.legal_name,
    application.phone,
    application.pickup_address,
    application.pickup_zip_code,
    application.food_handler_training_completed,
    application.food_handler_certificate_url,
    application.permit_or_certification_url,
    application.status,
    application.submitted_at,
    application.reviewed_at,
    application.review_notes,
    profile.display_name,
    profile.profile_image_url,
    profile.description,
    profile.cuisine_type,
    profile.preorder_cutoff_hours,
    profile.order_notes,
    profile.is_public,
    profile.rating,
    profile.review_count,
    limits.membership_tier,
    limits.menu_item_limit,
    exists (
      select 1 from lck_identity.user_roles cook_role
      where cook_role.user_id = application.user_id
        and cook_role.role = 'cook'
        and cook_role.revoked_at is null
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', item.name,
        'category', item.category,
        'price_cents', item.price_cents,
        'quantity_available', item.quantity_available,
        'is_active', item.is_active,
        'is_sold_out', item.is_sold_out,
        'created_at', item.created_at
      ) order by item.created_at desc)
      from lck_marketplace.cook_menu_items item
      where item.cook_id = application.user_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_of_week', pickup.day_of_week,
        'start_time', pickup.start_time,
        'end_time', pickup.end_time,
        'is_active', pickup.is_active
      ) order by pickup.day_of_week, pickup.start_time)
      from lck_marketplace.cook_pickup_windows pickup
      where pickup.cook_id = application.user_id
    ), '[]'::jsonb)
  from lck_marketplace.cook_applications application
  join lck_identity.users account on account.id = application.user_id
  left join lck_marketplace.cook_profiles profile on profile.cook_id = application.user_id
  left join lck_marketplace.cook_account_limits limits on limits.cook_id = application.user_id
  where application.user_id = p_cook_id;
end;
$$;

revoke all on function lck_identity.list_admin_cooks(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function lck_identity.list_admin_cooks(text, text, text, text, integer, integer)
  to authenticated;

revoke all on function lck_identity.get_admin_cook_detail(uuid) from public, anon;
grant execute on function lck_identity.get_admin_cook_detail(uuid) to authenticated;
