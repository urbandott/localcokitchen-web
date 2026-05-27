create extension if not exists pgcrypto;

create schema if not exists lck_identity;
create schema if not exists lck_marketplace;
create schema if not exists lck_private;

do $$
begin
  create type lck_identity.user_role as enum (
    'customer',
    'cook',
    'admin',
    'support_admin',
    'finance_admin',
    'super_admin'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists lck_identity.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  full_name text,
  marketing_opt_in boolean not null default true,
  marketing_opt_in_at timestamptz,
  avatar_url text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lck_identity.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lck_identity.users(id) on delete cascade,
  role lck_identity.user_role not null,
  granted_by uuid references lck_identity.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_roles_one_active_role unique nulls not distinct (user_id, role, revoked_at)
);

create index if not exists user_roles_user_id_idx on lck_identity.user_roles(user_id);
create index if not exists user_roles_active_role_idx
  on lck_identity.user_roles(role)
  where revoked_at is null;

create table if not exists lck_marketplace.cook_applications (
  user_id uuid primary key references lck_identity.users(id) on delete cascade,
  legal_name text not null,
  phone text not null,
  pickup_address text not null,
  pickup_zip_code text not null,
  food_handler_training_completed boolean not null default false,
  food_handler_certificate_url text not null,
  permit_or_certification_url text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'suspended')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references lck_identity.users(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_applications_training_required
    check (food_handler_training_completed is true),
  constraint cook_applications_legal_name_length
    check (char_length(btrim(legal_name)) between 2 and 120),
  constraint cook_applications_phone_us_format
    check (phone ~ '^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$'),
  constraint cook_applications_pickup_address_length
    check (char_length(btrim(pickup_address)) between 8 and 240),
  constraint cook_applications_zip_length
    check (pickup_zip_code ~ '^[0-9]{5}$')
);

create table if not exists lck_marketplace.cook_profiles (
  cook_id uuid primary key references lck_identity.users(id) on delete cascade,
  display_name text not null,
  profile_image_url text,
  description text,
  cuisine_type text,
  pickup_zip_code text,
  preorder_cutoff_hours integer not null default 24
    check (preorder_cutoff_hours between 1 and 168),
  order_notes text,
  is_public boolean not null default false,
  rating numeric(3, 2) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_profiles_description_length
    check (description is null or char_length(description) <= 3500),
  constraint cook_profiles_pickup_zip_length
    check (pickup_zip_code is null or pickup_zip_code ~ '^[0-9]{5}$')
);

create table if not exists lck_marketplace.cook_account_limits (
  cook_id uuid primary key references lck_identity.users(id) on delete cascade,
  menu_item_limit integer not null default 10 check (menu_item_limit between 0 and 500),
  membership_tier text not null default 'starter',
  updated_by uuid references lck_identity.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists lck_marketplace.cook_pickup_windows (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references lck_marketplace.cook_profiles(cook_id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_pickup_windows_valid_range check (start_time < end_time)
);

create table if not exists lck_marketplace.cook_menu_items (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references lck_marketplace.cook_profiles(cook_id) on delete cascade,
  name text not null,
  description text not null,
  image_url text not null,
  price_cents integer not null check (price_cents > 0),
  quantity_available integer not null default 0 check (quantity_available >= 0),
  category text,
  allergens text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  preorder_cutoff_at timestamptz,
  pickup_window_note text,
  is_sold_out boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_menu_items_name_length check (char_length(name) between 1 and 120),
  constraint cook_menu_items_description_length check (char_length(description) between 1 and 1200)
);

create index if not exists cook_menu_items_cook_id_idx on lck_marketplace.cook_menu_items(cook_id);
create index if not exists cook_pickup_windows_cook_id_idx on lck_marketplace.cook_pickup_windows(cook_id);
create index if not exists cook_profiles_public_idx
  on lck_marketplace.cook_profiles(is_public)
  where is_public;

create or replace function lck_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function lck_identity.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = lck_identity, public
as $$
declare
  marketing_opted_in boolean;
begin
  marketing_opted_in :=
    case
      when jsonb_typeof(new.raw_user_meta_data->'marketing_opt_in') = 'boolean'
        then (new.raw_user_meta_data->>'marketing_opt_in')::boolean
      else true
    end;

  insert into lck_identity.users (
    id,
    email,
    first_name,
    last_name,
    full_name,
    marketing_opt_in,
    marketing_opt_in_at,
    avatar_url,
    avatar_path
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(
        concat_ws(
          ' ',
          nullif(new.raw_user_meta_data->>'first_name', ''),
          nullif(new.raw_user_meta_data->>'last_name', '')
        ),
        ''
      )
    ),
    marketing_opted_in,
    case when marketing_opted_in then now() else null end,
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'avatar_path', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, lck_identity.users.first_name),
    last_name = coalesce(excluded.last_name, lck_identity.users.last_name),
    full_name = coalesce(excluded.full_name, lck_identity.users.full_name),
    marketing_opt_in = excluded.marketing_opt_in,
    marketing_opt_in_at = case
      when excluded.marketing_opt_in then coalesce(lck_identity.users.marketing_opt_in_at, now())
      else null
    end,
    avatar_url = excluded.avatar_url,
    avatar_path = excluded.avatar_path;

  insert into lck_identity.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

create or replace function lck_identity.current_user_has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = lck_identity, public
as $$
  select exists (
    select 1
    from lck_identity.user_roles admin_role
    where admin_role.user_id = auth.uid()
      and admin_role.role in ('admin', 'support_admin', 'finance_admin', 'super_admin')
      and admin_role.revoked_at is null
  );
$$;

create or replace function lck_identity.current_user_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = lck_identity, public
as $$
  select lck_identity.current_user_has_admin_role();
$$;

create or replace function public.lck_get_signup_account_status(email_input text)
returns text
language sql
stable
security definer
set search_path = auth, public
as $$
  select case
    when not exists (
      select 1
      from auth.users auth_user
      where lower(auth_user.email) = lower(btrim(email_input))
    ) then 'available'
    when exists (
      select 1
      from auth.users auth_user
      where lower(auth_user.email) = lower(btrim(email_input))
        and auth_user.confirmed_at is not null
    ) then 'active'
    else 'pending'
  end;
$$;

grant execute on function public.lck_get_signup_account_status(text) to anon, authenticated;

create or replace function lck_private.normalize_cook_application_user_write()
returns trigger
language plpgsql
security definer
set search_path = lck_marketplace, lck_identity, public
as $$
begin
  if lck_identity.current_user_has_admin_role() then
    return new;
  end if;

  new.user_id := auth.uid();
  new.status := 'submitted';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.review_notes := null;
  new.submitted_at := coalesce(new.submitted_at, now());

  return new;
end;
$$;

create or replace function lck_private.ensure_approved_cook_side_effects()
returns trigger
language plpgsql
security definer
set search_path = lck_marketplace, lck_identity, public
as $$
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  insert into lck_identity.user_roles (user_id, role)
  values (new.user_id, 'cook')
  on conflict do nothing;

  insert into lck_marketplace.cook_profiles (
    cook_id,
    display_name,
    pickup_zip_code,
    is_public
  )
  select
    new.user_id,
    coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1), 'Local cook'),
    new.pickup_zip_code,
    false
  from lck_identity.users u
  where u.id = new.user_id
  on conflict (cook_id) do update
  set pickup_zip_code = coalesce(lck_marketplace.cook_profiles.pickup_zip_code, excluded.pickup_zip_code);

  insert into lck_marketplace.cook_account_limits (cook_id, menu_item_limit, membership_tier)
  values (new.user_id, 10, 'starter')
  on conflict (cook_id) do nothing;

  return new;
end;
$$;

create or replace function lck_private.normalize_cook_profile_user_write()
returns trigger
language plpgsql
security definer
set search_path = lck_marketplace, lck_identity, public
as $$
begin
  if lck_identity.current_user_has_admin_role() then
    return new;
  end if;

  new.cook_id := auth.uid();

  if tg_op = 'UPDATE' then
    new.rating := old.rating;
    new.review_count := old.review_count;
  else
    new.rating := 0;
    new.review_count := 0;
  end if;

  if not exists (
    select 1
    from lck_marketplace.cook_applications app
    where app.user_id = auth.uid()
      and app.status = 'approved'
  ) then
    new.is_public := false;
  end if;

  return new;
end;
$$;

create or replace function lck_private.enforce_cook_menu_item_limit()
returns trigger
language plpgsql
security definer
set search_path = lck_marketplace, public
as $$
declare
  active_count integer;
  item_limit integer;
begin
  if new.is_active is not true then
    return new;
  end if;

  select coalesce(l.menu_item_limit, 10)
  into item_limit
  from lck_marketplace.cook_profiles p
  left join lck_marketplace.cook_account_limits l on l.cook_id = p.cook_id
  where p.cook_id = new.cook_id;

  item_limit := coalesce(item_limit, 10);

  select count(*)
  into active_count
  from lck_marketplace.cook_menu_items item
  where item.cook_id = new.cook_id
    and item.is_active is true
    and (tg_op = 'INSERT' or item.id <> new.id);

  if active_count >= item_limit then
    raise exception 'Menu item limit reached. Current limit is % active items.', item_limit
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function lck_identity.handle_auth_user_change();
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function lck_identity.handle_auth_user_change();

drop trigger if exists set_lck_identity_users_updated_at on lck_identity.users;
create trigger set_lck_identity_users_updated_at
  before update on lck_identity.users
  for each row execute function lck_private.set_updated_at();

drop trigger if exists set_cook_applications_updated_at on lck_marketplace.cook_applications;
create trigger set_cook_applications_updated_at
  before update on lck_marketplace.cook_applications
  for each row execute function lck_private.set_updated_at();

drop trigger if exists normalize_cook_application_user_write on lck_marketplace.cook_applications;
create trigger normalize_cook_application_user_write
  before insert or update on lck_marketplace.cook_applications
  for each row execute function lck_private.normalize_cook_application_user_write();

drop trigger if exists on_cook_application_approved on lck_marketplace.cook_applications;
create trigger on_cook_application_approved
  after update of status on lck_marketplace.cook_applications
  for each row execute function lck_private.ensure_approved_cook_side_effects();

drop trigger if exists set_cook_profiles_updated_at on lck_marketplace.cook_profiles;
create trigger set_cook_profiles_updated_at
  before update on lck_marketplace.cook_profiles
  for each row execute function lck_private.set_updated_at();

drop trigger if exists normalize_cook_profile_user_write on lck_marketplace.cook_profiles;
create trigger normalize_cook_profile_user_write
  before insert or update on lck_marketplace.cook_profiles
  for each row execute function lck_private.normalize_cook_profile_user_write();

drop trigger if exists set_cook_pickup_windows_updated_at on lck_marketplace.cook_pickup_windows;
create trigger set_cook_pickup_windows_updated_at
  before update on lck_marketplace.cook_pickup_windows
  for each row execute function lck_private.set_updated_at();

drop trigger if exists set_cook_menu_items_updated_at on lck_marketplace.cook_menu_items;
create trigger set_cook_menu_items_updated_at
  before update on lck_marketplace.cook_menu_items
  for each row execute function lck_private.set_updated_at();

drop trigger if exists enforce_cook_menu_item_limit on lck_marketplace.cook_menu_items;
create trigger enforce_cook_menu_item_limit
  before insert or update on lck_marketplace.cook_menu_items
  for each row execute function lck_private.enforce_cook_menu_item_limit();

alter table lck_identity.users enable row level security;
alter table lck_identity.user_roles enable row level security;
alter table lck_marketplace.cook_applications enable row level security;
alter table lck_marketplace.cook_profiles enable row level security;
alter table lck_marketplace.cook_account_limits enable row level security;
alter table lck_marketplace.cook_pickup_windows enable row level security;
alter table lck_marketplace.cook_menu_items enable row level security;

drop policy if exists "Users can read their own identity profile" on lck_identity.users;
create policy "Users can read their own identity profile"
  on lck_identity.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admins can read all identity profiles" on lck_identity.users;
create policy "Admins can read all identity profiles"
  on lck_identity.users
  for select
  to authenticated
  using (lck_identity.current_user_has_admin_role());

drop policy if exists "Users can read their own roles" on lck_identity.user_roles;
create policy "Users can read their own roles"
  on lck_identity.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all user roles" on lck_identity.user_roles;
create policy "Admins can read all user roles"
  on lck_identity.user_roles
  for select
  to authenticated
  using (lck_identity.current_user_has_admin_role());

drop policy if exists "Users can read their own cook application" on lck_marketplace.cook_applications;
create policy "Users can read their own cook application"
  on lck_marketplace.cook_applications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can submit their own cook application" on lck_marketplace.cook_applications;
create policy "Users can submit their own cook application"
  on lck_marketplace.cook_applications
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and status = 'submitted');

drop policy if exists "Admins manage cook applications" on lck_marketplace.cook_applications;
create policy "Admins manage cook applications"
  on lck_marketplace.cook_applications
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

drop policy if exists "Public can read public cook profiles" on lck_marketplace.cook_profiles;
create policy "Public can read public cook profiles"
  on lck_marketplace.cook_profiles
  for select
  to anon, authenticated
  using (
    is_public is true
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_profiles.cook_id
        and app.status = 'approved'
    )
  );

drop policy if exists "Cooks manage their own profile" on lck_marketplace.cook_profiles;
create policy "Cooks manage their own profile"
  on lck_marketplace.cook_profiles
  for all
  to authenticated
  using (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_profiles.cook_id
        and app.status = 'approved'
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_profiles.cook_id
        and app.status = 'approved'
    )
  );

drop policy if exists "Admins manage cook profiles" on lck_marketplace.cook_profiles;
create policy "Admins manage cook profiles"
  on lck_marketplace.cook_profiles
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

drop policy if exists "Cooks read their own account limits" on lck_marketplace.cook_account_limits;
create policy "Cooks read their own account limits"
  on lck_marketplace.cook_account_limits
  for select
  to authenticated
  using ((select auth.uid()) = cook_id or lck_identity.current_user_has_admin_role());

drop policy if exists "Admins manage cook account limits" on lck_marketplace.cook_account_limits;
create policy "Admins manage cook account limits"
  on lck_marketplace.cook_account_limits
  for all
  to authenticated
  using (lck_identity.current_user_has_admin_role())
  with check (lck_identity.current_user_has_admin_role());

drop policy if exists "Public can read active pickup windows for public cooks" on lck_marketplace.cook_pickup_windows;
create policy "Public can read active pickup windows for public cooks"
  on lck_marketplace.cook_pickup_windows
  for select
  to anon, authenticated
  using (
    is_active is true
    and exists (
      select 1
      from lck_marketplace.cook_profiles p
      where p.cook_id = cook_pickup_windows.cook_id
        and p.is_public is true
        and exists (
          select 1
          from lck_marketplace.cook_applications app
          where app.user_id = p.cook_id
            and app.status = 'approved'
        )
    )
  );

drop policy if exists "Cooks manage their pickup windows" on lck_marketplace.cook_pickup_windows;
create policy "Cooks manage their pickup windows"
  on lck_marketplace.cook_pickup_windows
  for all
  to authenticated
  using (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_pickup_windows.cook_id
        and app.status = 'approved'
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_pickup_windows.cook_id
        and app.status = 'approved'
    )
  );

drop policy if exists "Public can read active menu items for public cooks" on lck_marketplace.cook_menu_items;
create policy "Public can read active menu items for public cooks"
  on lck_marketplace.cook_menu_items
  for select
  to anon, authenticated
  using (
    is_active is true
    and exists (
      select 1
      from lck_marketplace.cook_profiles p
      where p.cook_id = cook_menu_items.cook_id
        and p.is_public is true
        and exists (
          select 1
          from lck_marketplace.cook_applications app
          where app.user_id = p.cook_id
            and app.status = 'approved'
        )
    )
  );

drop policy if exists "Cooks manage their menu items" on lck_marketplace.cook_menu_items;
create policy "Cooks manage their menu items"
  on lck_marketplace.cook_menu_items
  for all
  to authenticated
  using (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_menu_items.cook_id
        and app.status = 'approved'
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_menu_items.cook_id
        and app.status = 'approved'
    )
  );

grant usage on schema lck_identity, lck_marketplace to anon, authenticated;
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, lck_identity, lck_marketplace';
notify pgrst, 'reload config';

grant execute on function lck_identity.current_user_is_admin() to authenticated;
grant select on
  lck_marketplace.cook_applications,
  lck_marketplace.cook_profiles,
  lck_marketplace.cook_pickup_windows,
  lck_marketplace.cook_menu_items
  to anon;
grant select on lck_identity.users, lck_identity.user_roles to authenticated;
grant select, insert, update, delete on
  lck_marketplace.cook_applications,
  lck_marketplace.cook_profiles,
  lck_marketplace.cook_account_limits,
  lck_marketplace.cook_pickup_windows,
  lck_marketplace.cook_menu_items
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'cook-documents',
    'cook-documents',
    false,
    5242880,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'profile-images',
    'profile-images',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'cook-profile-images',
    'cook-profile-images',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'cook-menu-images',
    'cook-menu-images',
    true,
    3145728,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload account profile images" on storage.objects;
create policy "Users upload account profile images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update account profile images" on storage.objects;
create policy "Users update account profile images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete account profile images" on storage.objects;
create policy "Users delete account profile images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Anyone reads account profile images" on storage.objects;
create policy "Anyone reads account profile images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their cook documents" on storage.objects;
create policy "Users can upload their cook documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cook-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their cook documents" on storage.objects;
create policy "Users can read their cook documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cook-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or lck_identity.current_user_has_admin_role()
    )
  );

drop policy if exists "Cooks upload profile images" on storage.objects;
create policy "Cooks upload profile images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = (select auth.uid())
        and app.status = 'approved'
    )
  );

drop policy if exists "Cooks update profile images" on storage.objects;
create policy "Cooks update profile images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = (select auth.uid())
        and app.status = 'approved'
    )
  );

drop policy if exists "Anyone reads profile images" on storage.objects;
create policy "Anyone reads profile images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cook-profile-images');

drop policy if exists "Cooks upload menu images" on storage.objects;
create policy "Cooks upload menu images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = (select auth.uid())
        and app.status = 'approved'
    )
  );

drop policy if exists "Cooks update menu images" on storage.objects;
create policy "Cooks update menu images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = (select auth.uid())
        and app.status = 'approved'
    )
  );

drop policy if exists "Anyone reads menu images" on storage.objects;
create policy "Anyone reads menu images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cook-menu-images');
