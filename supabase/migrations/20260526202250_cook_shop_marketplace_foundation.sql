create extension if not exists pgcrypto;

create table if not exists public.cook_applications (
  user_id uuid primary key references identity.users(id) on delete cascade,
  legal_name text not null,
  phone text,
  pickup_address text,
  pickup_zip_code text not null,
  food_handler_training_completed boolean not null default false,
  food_handler_certificate_url text not null,
  permit_or_certification_url text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'suspended')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references identity.users(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_applications_training_required
    check (food_handler_training_completed is true),
  constraint cook_applications_zip_length
    check (char_length(pickup_zip_code) between 5 and 12)
);

create table if not exists public.cook_profiles (
  cook_id uuid primary key references identity.users(id) on delete cascade,
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
    check (description is null or char_length(description) <= 3500)
);

create table if not exists public.cook_account_limits (
  cook_id uuid primary key references identity.users(id) on delete cascade,
  menu_item_limit integer not null default 10 check (menu_item_limit between 0 and 500),
  membership_tier text not null default 'starter',
  updated_by uuid references identity.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.cook_pickup_windows (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references public.cook_profiles(cook_id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cook_pickup_windows_valid_range check (start_time < end_time)
);

create table if not exists public.cook_menu_items (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references public.cook_profiles(cook_id) on delete cascade,
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
  constraint cook_menu_items_name_length check (char_length(name) <= 120),
  constraint cook_menu_items_description_length check (char_length(description) <= 1200)
);

create index if not exists cook_menu_items_cook_id_idx on public.cook_menu_items(cook_id);
create index if not exists cook_pickup_windows_cook_id_idx on public.cook_pickup_windows(cook_id);
create index if not exists cook_profiles_public_idx on public.cook_profiles(is_public) where is_public;

create or replace function public.current_user_has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = identity, public
as $$
  select identity.current_user_has_admin_role();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_cook_application_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public, identity
as $$
begin
  insert into identity.user_roles (user_id, role)
  values (new.user_id, 'cook')
  on conflict do nothing;

  insert into public.cook_profiles (
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
  from identity.users u
  where u.id = new.user_id
  on conflict (cook_id) do update
  set pickup_zip_code = coalesce(public.cook_profiles.pickup_zip_code, excluded.pickup_zip_code);

  insert into public.cook_account_limits (cook_id, menu_item_limit, membership_tier)
  values (new.user_id, 10, 'starter')
  on conflict (cook_id) do nothing;

  return new;
end;
$$;

create or replace function public.normalize_cook_application_user_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_has_admin_role() then
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

create or replace function public.enforce_cook_menu_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
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
  from public.cook_profiles p
  left join public.cook_account_limits l on l.cook_id = p.cook_id
  where p.cook_id = new.cook_id;

  item_limit := coalesce(item_limit, 10);

  select count(*)
  into active_count
  from public.cook_menu_items item
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

drop trigger if exists set_cook_applications_updated_at on public.cook_applications;
create trigger set_cook_applications_updated_at
  before update on public.cook_applications
  for each row execute function public.set_updated_at();

drop trigger if exists normalize_cook_application_user_write on public.cook_applications;
create trigger normalize_cook_application_user_write
  before insert or update on public.cook_applications
  for each row execute function public.normalize_cook_application_user_write();

drop trigger if exists set_cook_profiles_updated_at on public.cook_profiles;
create trigger set_cook_profiles_updated_at
  before update on public.cook_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_cook_pickup_windows_updated_at on public.cook_pickup_windows;
create trigger set_cook_pickup_windows_updated_at
  before update on public.cook_pickup_windows
  for each row execute function public.set_updated_at();

drop trigger if exists set_cook_menu_items_updated_at on public.cook_menu_items;
create trigger set_cook_menu_items_updated_at
  before update on public.cook_menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists on_cook_application_submitted on public.cook_applications;
create trigger on_cook_application_submitted
  after insert on public.cook_applications
  for each row execute function public.ensure_cook_application_side_effects();

drop trigger if exists enforce_cook_menu_item_limit on public.cook_menu_items;
create trigger enforce_cook_menu_item_limit
  before insert or update on public.cook_menu_items
  for each row execute function public.enforce_cook_menu_item_limit();

alter table public.cook_applications enable row level security;
alter table public.cook_profiles enable row level security;
alter table public.cook_account_limits enable row level security;
alter table public.cook_pickup_windows enable row level security;
alter table public.cook_menu_items enable row level security;

drop policy if exists "Users manage their own cook application" on public.cook_applications;
create policy "Users manage their own cook application"
  on public.cook_applications
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins manage cook applications" on public.cook_applications;
create policy "Admins manage cook applications"
  on public.cook_applications
  for all
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

drop policy if exists "Public can read public cook profiles" on public.cook_profiles;
create policy "Public can read public cook profiles"
  on public.cook_profiles
  for select
  to anon, authenticated
  using (is_public is true);

drop policy if exists "Cooks manage their own profile" on public.cook_profiles;
create policy "Cooks manage their own profile"
  on public.cook_profiles
  for all
  to authenticated
  using (auth.uid() = cook_id)
  with check (auth.uid() = cook_id);

drop policy if exists "Admins manage cook profiles" on public.cook_profiles;
create policy "Admins manage cook profiles"
  on public.cook_profiles
  for all
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

drop policy if exists "Cooks read their own account limits" on public.cook_account_limits;
create policy "Cooks read their own account limits"
  on public.cook_account_limits
  for select
  to authenticated
  using (auth.uid() = cook_id or public.current_user_has_admin_role());

drop policy if exists "Admins manage cook account limits" on public.cook_account_limits;
create policy "Admins manage cook account limits"
  on public.cook_account_limits
  for all
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

drop policy if exists "Public can read active pickup windows for public cooks" on public.cook_pickup_windows;
create policy "Public can read active pickup windows for public cooks"
  on public.cook_pickup_windows
  for select
  to anon, authenticated
  using (
    is_active is true
    and exists (
      select 1 from public.cook_profiles p
      where p.cook_id = cook_pickup_windows.cook_id
        and p.is_public is true
    )
  );

drop policy if exists "Cooks manage their pickup windows" on public.cook_pickup_windows;
create policy "Cooks manage their pickup windows"
  on public.cook_pickup_windows
  for all
  to authenticated
  using (auth.uid() = cook_id)
  with check (auth.uid() = cook_id);

drop policy if exists "Public can read active menu items for public cooks" on public.cook_menu_items;
create policy "Public can read active menu items for public cooks"
  on public.cook_menu_items
  for select
  to anon, authenticated
  using (
    is_active is true
    and exists (
      select 1 from public.cook_profiles p
      where p.cook_id = cook_menu_items.cook_id
        and p.is_public is true
    )
  );

drop policy if exists "Cooks manage their menu items" on public.cook_menu_items;
create policy "Cooks manage their menu items"
  on public.cook_menu_items
  for all
  to authenticated
  using (auth.uid() = cook_id)
  with check (auth.uid() = cook_id);

grant usage on schema public to anon, authenticated;
grant select on public.cook_profiles, public.cook_pickup_windows, public.cook_menu_items to anon;
grant select, insert, update, delete on
  public.cook_applications,
  public.cook_profiles,
  public.cook_pickup_windows,
  public.cook_menu_items
to authenticated;
grant select on public.cook_account_limits to authenticated;

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

drop policy if exists "Users can upload their cook documents" on storage.objects;
create policy "Users can upload their cook documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cook-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read their cook documents" on storage.objects;
create policy "Users can read their cook documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cook-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_has_admin_role()
    )
  );

drop policy if exists "Cooks upload profile images" on storage.objects;
create policy "Cooks upload profile images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Cooks update profile images" on storage.objects;
create policy "Cooks update profile images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
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
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Cooks update menu images" on storage.objects;
create policy "Cooks update menu images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone reads menu images" on storage.objects;
create policy "Anyone reads menu images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cook-menu-images');
