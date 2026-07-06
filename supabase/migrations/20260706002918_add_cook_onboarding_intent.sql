-- Cook onboarding intent is a navigation preference, never an authorization
-- signal. Applications, approvals, and cook operations remain protected by
-- their existing RLS predicates and database roles.
alter table lck_identity.users
  add column if not exists cook_onboarding_started_at timestamptz;

grant update (cook_onboarding_started_at)
  on lck_identity.users
  to authenticated;

create or replace function lck_identity.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_identity
as $$
declare
  marketing_opted_in boolean;
  cook_onboarding_started_at timestamptz;
begin
  marketing_opted_in :=
    case
      when jsonb_typeof(new.raw_user_meta_data->'marketing_opt_in') = 'boolean'
        then (new.raw_user_meta_data->>'marketing_opt_in')::boolean
      else false
    end;

  cook_onboarding_started_at :=
    case
      when lower(coalesce(new.raw_user_meta_data->>'account_intent', '')) = 'cook'
        then now()
      else null
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
    avatar_path,
    cook_onboarding_started_at
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
    nullif(new.raw_user_meta_data->>'avatar_path', ''),
    cook_onboarding_started_at
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
    avatar_url = coalesce(excluded.avatar_url, lck_identity.users.avatar_url),
    avatar_path = coalesce(excluded.avatar_path, lck_identity.users.avatar_path),
    cook_onboarding_started_at = coalesce(
      lck_identity.users.cook_onboarding_started_at,
      excluded.cook_onboarding_started_at
    );

  insert into lck_identity.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function lck_identity.handle_auth_user_change()
  from public, anon, authenticated;
