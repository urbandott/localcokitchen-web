alter table identity.users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz;

update identity.users
set
  first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
  last_name = coalesce(
    last_name,
    nullif(
      btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)),
      ''
    )
  )
where full_name is not null
  and (first_name is null or last_name is null);

create or replace function identity.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = identity, public
as $$
declare
  marketing_opted_in boolean;
begin
  marketing_opted_in :=
    case
      when jsonb_typeof(new.raw_user_meta_data->'marketing_opt_in') = 'boolean'
        then (new.raw_user_meta_data->>'marketing_opt_in')::boolean
      else false
    end;
  insert into identity.users (
    id,
    email,
    first_name,
    last_name,
    full_name,
    marketing_opt_in,
    marketing_opt_in_at,
    avatar_url
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
    case
      when marketing_opted_in then now()
      else null
    end,
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, identity.users.first_name),
    last_name = coalesce(excluded.last_name, identity.users.last_name),
    full_name = coalesce(excluded.full_name, identity.users.full_name),
    marketing_opt_in = excluded.marketing_opt_in,
    marketing_opt_in_at = coalesce(excluded.marketing_opt_in_at, identity.users.marketing_opt_in_at),
    avatar_url = coalesce(excluded.avatar_url, identity.users.avatar_url);

  insert into identity.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;
