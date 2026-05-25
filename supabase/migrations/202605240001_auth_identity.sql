-- LocalCoKitchen auth identity foundation.
-- Run this in Supabase before enabling the sign-up page in production.

create schema if not exists identity;

do $$
begin
  create type identity.user_role as enum (
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

create table if not exists identity.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identity.users(id) on delete cascade,
  role identity.user_role not null,
  granted_by uuid references identity.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_roles_one_active_role unique nulls not distinct (user_id, role, revoked_at)
);

create index if not exists user_roles_user_id_idx on identity.user_roles(user_id);
create index if not exists user_roles_active_role_idx
  on identity.user_roles(role)
  where revoked_at is null;

create or replace function identity.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_identity_users_updated_at on identity.users;
create trigger set_identity_users_updated_at
  before update on identity.users
  for each row
  execute function identity.set_updated_at();

create or replace function identity.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = identity, public
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'signup_role', 'customer');

  insert into identity.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, identity.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, identity.users.avatar_url);

  insert into identity.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  if requested_role in ('cook', 'both') then
    insert into identity.user_roles (user_id, role)
    values (new.id, 'cook')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function identity.current_user_has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = identity, public
as $$
  select exists (
    select 1
    from identity.user_roles admin_role
    where admin_role.user_id = auth.uid()
      and admin_role.role in ('admin', 'support_admin', 'finance_admin', 'super_admin')
      and admin_role.revoked_at is null
  );
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function identity.handle_new_auth_user();

alter table identity.users enable row level security;
alter table identity.user_roles enable row level security;

drop policy if exists "Users can read their own identity profile" on identity.users;
create policy "Users can read their own identity profile"
  on identity.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update their own identity profile" on identity.users;
create policy "Users can update their own identity profile"
  on identity.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read their own roles" on identity.user_roles;
create policy "Users can read their own roles"
  on identity.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all identity profiles" on identity.users;
create policy "Admins can read all identity profiles"
  on identity.users
  for select
  to authenticated
  using (identity.current_user_has_admin_role());

drop policy if exists "Admins can read all user roles" on identity.user_roles;
create policy "Admins can read all user roles"
  on identity.user_roles
  for select
  to authenticated
  using (identity.current_user_has_admin_role());
