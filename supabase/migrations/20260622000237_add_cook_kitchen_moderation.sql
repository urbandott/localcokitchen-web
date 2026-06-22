alter table lck_marketplace.cook_profiles
  add column if not exists moderator_disabled_at timestamptz,
  add column if not exists moderator_disabled_by uuid
    references lck_identity.users(id);

create index if not exists cook_profiles_moderator_disabled_idx
  on lck_marketplace.cook_profiles(moderator_disabled_at)
  where moderator_disabled_at is not null;

create or replace function lck_private.normalize_cook_profile_user_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_marketplace, lck_identity
as $$
begin
  if lck_identity.current_user_has_admin_role() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.moderator_disabled_at is not null then
      raise exception using
        message = 'The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com for more information.',
        errcode = '42501';
    end if;
    return old;
  end if;

  new.cook_id := (select auth.uid());

  if tg_op = 'UPDATE' then
    new.rating := old.rating;
    new.review_count := old.review_count;
    new.moderator_disabled_at := old.moderator_disabled_at;
    new.moderator_disabled_by := old.moderator_disabled_by;

    if old.moderator_disabled_at is not null and new.is_public then
      raise exception using
        message = 'The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com for more information.',
        errcode = '42501';
    end if;
  else
    new.rating := 0;
    new.review_count := 0;
    new.moderator_disabled_at := null;
    new.moderator_disabled_by := null;
  end if;

  if not exists (
    select 1
    from lck_marketplace.cook_applications application
    where application.user_id = (select auth.uid())
      and application.status in ('submitted', 'approved')
  ) then
    new.is_public := false;
  end if;

  return new;
end;
$$;

revoke all on function lck_private.normalize_cook_profile_user_write()
  from public, anon, authenticated;

drop trigger if exists normalize_cook_profile_user_write
  on lck_marketplace.cook_profiles;
create trigger normalize_cook_profile_user_write
  before insert or update or delete on lck_marketplace.cook_profiles
  for each row execute function lck_private.normalize_cook_profile_user_write();

create or replace function lck_identity.set_admin_cook_kitchen_disabled(
  p_cook_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = pg_catalog, lck_identity, lck_marketplace
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  if p_cook_id is null or p_disabled is null then
    raise exception using message = 'Cook and moderation state are required.', errcode = '22023';
  end if;

  update lck_marketplace.cook_profiles profile
  set
    moderator_disabled_at = case
      when p_disabled then coalesce(profile.moderator_disabled_at, now())
      else null
    end,
    moderator_disabled_by = case
      when p_disabled then (select auth.uid())
      else null
    end,
    is_public = case when p_disabled then false else profile.is_public end
  where profile.cook_id = p_cook_id;

  if not found then
    raise exception using message = 'Cook profile not found.', errcode = 'P0002';
  end if;

  return p_disabled;
end;
$$;

revoke all on function lck_identity.set_admin_cook_kitchen_disabled(uuid, boolean)
  from public, anon;
grant execute on function lck_identity.set_admin_cook_kitchen_disabled(uuid, boolean)
  to authenticated;

drop function if exists lck_identity.get_admin_cook_detail(uuid);
create function lck_identity.get_admin_cook_detail(p_cook_id uuid)
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
  moderator_disabled_at timestamptz,
  moderator_disabled_by uuid,
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
    profile.moderator_disabled_at,
    profile.moderator_disabled_by,
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

revoke all on function lck_identity.get_admin_cook_detail(uuid) from public, anon;
grant execute on function lck_identity.get_admin_cook_detail(uuid) to authenticated;
