-- Record the specifically provisioned owner so an email change can revoke the
-- bootstrap grant. This migration deliberately refuses to auto-promote future
-- signups based only on an email address.
create table if not exists lck_private.admin_bootstrap_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  constraint admin_bootstrap_grant_email_normalized check (email = lower(btrim(email)))
);

create or replace function lck_private.revoke_changed_bootstrap_admin_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
begin
  if exists (
    select 1
    from lck_private.admin_bootstrap_grants bootstrap
    where bootstrap.user_id = new.id
      and (
        bootstrap.email <> lower(btrim(coalesce(new.email, '')))
        or new.email_confirmed_at is null
      )
  ) then
    update lck_identity.user_roles
    set revoked_at = now()
    where user_id = new.id
      and role = 'super_admin'
      and revoked_at is null;

    delete from lck_private.admin_bootstrap_grants where user_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function lck_private.revoke_changed_bootstrap_admin_role() from public, anon, authenticated;
revoke all on table lck_private.admin_bootstrap_grants from public, anon, authenticated;

drop trigger if exists revoke_changed_bootstrap_admin_role on auth.users;
create trigger revoke_changed_bootstrap_admin_role
  after update of email, email_confirmed_at on auth.users
  for each row execute function lck_private.revoke_changed_bootstrap_admin_role();

-- Fail closed unless the mailbox owner has already created and confirmed the
-- Auth account. This prevents accidental promotion when email confirmation is
-- disabled in a Supabase project.
do $$
begin
  if not exists (
    select 1
    from auth.users auth_user
    where lower(btrim(auth_user.email)) = 'localcokitchen@gmail.com'
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception using
      message = 'Confirmed Auth account localcokitchen@gmail.com must exist before applying this migration.',
      errcode = 'P0001';
  end if;
end;
$$;

insert into lck_identity.user_roles (user_id, role)
select auth_user.id, 'super_admin'::lck_identity.user_role
from auth.users auth_user
where lower(btrim(auth_user.email)) = 'localcokitchen@gmail.com'
  and auth_user.email_confirmed_at is not null
on conflict do nothing;

insert into lck_private.admin_bootstrap_grants (user_id, email)
select auth_user.id, 'localcokitchen@gmail.com'
from auth.users auth_user
where lower(btrim(auth_user.email)) = 'localcokitchen@gmail.com'
  and auth_user.email_confirmed_at is not null
on conflict (user_id) do nothing;

-- This private helper permits the password-authenticated owner to begin MFA.
-- It never grants access to admin records.
create or replace function lck_private.current_user_has_admin_role_at_aal1()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, lck_identity
as $$
  select exists (
    select 1
    from lck_identity.user_roles admin_role
    where admin_role.user_id = (select auth.uid())
      and admin_role.role in ('admin', 'support_admin', 'finance_admin', 'super_admin')
      and admin_role.revoked_at is null
  );
$$;

revoke all on function lck_private.current_user_has_admin_role_at_aal1() from public, anon, authenticated;

create or replace function lck_identity.current_user_can_start_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, lck_private
as $$
  select lck_private.current_user_has_admin_role_at_aal1();
$$;

revoke all on function lck_identity.current_user_can_start_admin_mfa() from public, anon;
grant execute on function lck_identity.current_user_can_start_admin_mfa() to authenticated;

-- Replace the shared admin predicate so database and Storage policies require
-- both an active database role and an MFA-verified JWT.
create or replace function lck_identity.current_user_has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, lck_private
as $$
  select
    (select auth.jwt()->>'aal') = 'aal2'
    and lck_private.current_user_has_admin_role_at_aal1();
$$;

revoke all on function lck_identity.current_user_has_admin_role() from public, anon, authenticated;

create or replace function lck_identity.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, lck_identity
as $$
  select lck_identity.current_user_has_admin_role();
$$;

revoke all on function lck_identity.current_user_is_admin() from public, anon;
grant execute on function lck_identity.current_user_is_admin() to authenticated;
