-- Remove the anonymous email-enumeration endpoint. Supabase Auth signup and
-- password recovery already provide privacy-preserving responses.
revoke all on function public.lck_get_signup_account_status(text)
  from public, anon, authenticated;
drop function if exists public.lck_get_signup_account_status(text);

-- Marketing consent must be explicit, not opt-out by default.
alter table lck_identity.users
  alter column marketing_opt_in set default false;

-- Durable, immutable records for privileged actions and security-relevant
-- product events. These tables stay in the unexposed private schema.
create table if not exists lck_private.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references lck_identity.users(id),
  action text not null check (char_length(action) between 3 and 100),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lck_private.system_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) between 3 and 120),
  actor_user_id uuid references lck_identity.users(id),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_actor_created_idx
  on lck_private.admin_actions(actor_user_id, created_at desc);
create index if not exists admin_actions_target_created_idx
  on lck_private.admin_actions(target_type, target_id, created_at desc);
create index if not exists system_events_name_created_idx
  on lck_private.system_events(event_name, created_at desc);
create index if not exists system_events_target_created_idx
  on lck_private.system_events(target_type, target_id, created_at desc);

alter table lck_private.admin_actions enable row level security;
alter table lck_private.system_events enable row level security;
revoke all on table lck_private.admin_actions, lck_private.system_events
  from public, anon, authenticated;

create or replace function lck_private.audit_cook_kitchen_moderation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  event_name text;
begin
  if new.moderator_disabled_at is not distinct from old.moderator_disabled_at then
    return new;
  end if;

  event_name := case
    when new.moderator_disabled_at is null then 'cook.kitchen_reenabled'
    else 'cook.kitchen_disabled'
  end;

  insert into lck_private.admin_actions (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    (select auth.uid()), event_name, 'cook', new.cook_id,
    jsonb_build_object('was_public', old.is_public)
  );

  insert into lck_private.system_events (
    event_name, actor_user_id, target_type, target_id, severity, metadata
  ) values (
    event_name, (select auth.uid()), 'cook', new.cook_id,
    case when new.moderator_disabled_at is null then 'info' else 'warning' end,
    jsonb_build_object('was_public', old.is_public)
  );

  return new;
end;
$$;

revoke all on function lck_private.audit_cook_kitchen_moderation()
  from public, anon, authenticated;
drop trigger if exists audit_cook_kitchen_moderation
  on lck_marketplace.cook_profiles;
create trigger audit_cook_kitchen_moderation
  after update of moderator_disabled_at on lck_marketplace.cook_profiles
  for each row execute function lck_private.audit_cook_kitchen_moderation();

create or replace function lck_private.audit_cook_application_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_private
as $$
declare
  actor_id uuid := coalesce(new.reviewed_by, (select auth.uid()));
  event_name text;
begin
  if new.status is not distinct from old.status
    or new.status not in ('approved', 'rejected', 'suspended') then
    return new;
  end if;

  event_name := 'cook.' || new.status;
  insert into lck_private.admin_actions (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    actor_id, event_name, 'cook', new.user_id,
    jsonb_build_object('previous_status', old.status)
  );
  insert into lck_private.system_events (
    event_name, actor_user_id, target_type, target_id, severity, metadata
  ) values (
    event_name, actor_id, 'cook', new.user_id,
    case when new.status = 'approved' then 'info' else 'warning' end,
    jsonb_build_object('previous_status', old.status)
  );
  return new;
end;
$$;

revoke all on function lck_private.audit_cook_application_status()
  from public, anon, authenticated;
drop trigger if exists audit_cook_application_status
  on lck_marketplace.cook_applications;
create trigger audit_cook_application_status
  after update of status on lck_marketplace.cook_applications
  for each row execute function lck_private.audit_cook_application_status();

create or replace function lck_identity.record_admin_login()
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;
  insert into lck_private.admin_actions (
    actor_user_id, action, target_type, target_id
  ) values ((select auth.uid()), 'admin.login', 'admin', (select auth.uid()));
  insert into lck_private.system_events (
    event_name, actor_user_id, target_type, target_id
  ) values ('admin.login', (select auth.uid()), 'admin', (select auth.uid()));
end;
$$;

revoke all on function lck_identity.record_admin_login() from public, anon;
grant execute on function lck_identity.record_admin_login() to authenticated;

-- Cooks may prepare a draft profile while under review, but they cannot mark
-- it public before approval. The trigger is also the enforcement point for
-- moderator locks, preventing direct Data API bypasses.
create or replace function lck_private.normalize_cook_profile_user_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_marketplace, lck_identity
as $$
begin
  if lck_identity.current_user_has_admin_role() then
    if tg_op = 'DELETE' then return old; end if;
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
    select 1 from lck_marketplace.cook_applications application
    where application.user_id = (select auth.uid())
      and application.status = 'approved'
  ) then
    new.is_public := false;
  end if;
  return new;
end;
$$;

revoke all on function lck_private.normalize_cook_profile_user_write()
  from public, anon, authenticated;

-- Serialize limit checks per cook so concurrent inserts cannot both pass.
create or replace function lck_private.enforce_cook_menu_item_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_marketplace
as $$
declare
  active_count integer;
  item_limit integer;
begin
  if new.is_active is not true then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('cook-menu-limit:' || new.cook_id::text, 0));

  select coalesce(limits.menu_item_limit, 10)
  into item_limit
  from lck_marketplace.cook_profiles profile
  left join lck_marketplace.cook_account_limits limits
    on limits.cook_id = profile.cook_id
  where profile.cook_id = new.cook_id;
  item_limit := coalesce(item_limit, 10);

  select count(*) into active_count
  from lck_marketplace.cook_menu_items item
  where item.cook_id = new.cook_id
    and item.is_active
    and (tg_op = 'INSERT' or item.id <> new.id);

  if active_count >= item_limit then
    raise exception 'Menu item limit reached. Current limit is % active items.', item_limit
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function lck_private.enforce_cook_menu_item_limit()
  from public, anon, authenticated;

-- Food labeling and profile validation must hold for direct API clients too.
alter table lck_marketplace.cook_menu_items
  add column if not exists allergens text[] not null default '{}';
alter table lck_marketplace.cook_menu_items
  drop constraint if exists cook_menu_items_allergens_limit,
  add constraint cook_menu_items_allergens_limit
    check (lck_private.text_array_items_within(allergens, 12, 40)),
  drop constraint if exists cook_menu_items_allergens_none_exclusive,
  add constraint cook_menu_items_allergens_none_exclusive
    check (not ('None declared' = any(allergens)) or cardinality(allergens) = 1),
  drop constraint if exists cook_menu_items_active_ingredients_required,
  add constraint cook_menu_items_active_ingredients_required
    check (not is_active or cardinality(main_ingredients) > 0) not valid,
  drop constraint if exists cook_menu_items_active_allergens_required,
  add constraint cook_menu_items_active_allergens_required
    check (not is_active or cardinality(allergens) > 0) not valid;

alter table lck_marketplace.cook_profiles
  drop constraint if exists cook_profiles_display_name_length,
  add constraint cook_profiles_display_name_length
    check (char_length(btrim(display_name)) between 2 and 120) not valid,
  drop constraint if exists cook_profiles_cuisine_type_length,
  add constraint cook_profiles_cuisine_type_length
    check (cuisine_type is null or char_length(btrim(cuisine_type)) between 1 and 80) not valid,
  drop constraint if exists cook_profiles_order_notes_length,
  add constraint cook_profiles_order_notes_length
    check (order_notes is null or char_length(order_notes) <= 800) not valid,
  drop constraint if exists cook_profiles_image_owned_path,
  add constraint cook_profiles_image_owned_path
    check (
      profile_image_url is null
      or profile_image_url like cook_id::text || '/%'
      or profile_image_url like '%/cook-profile-images/' || cook_id::text || '/%'
    ) not valid;

alter table lck_marketplace.cook_menu_items
  drop constraint if exists cook_menu_items_image_owned_path,
  add constraint cook_menu_items_image_owned_path
    check (
      image_url like cook_id::text || '/%'
      or image_url like '%/cook-menu-images/' || cook_id::text || '/%'
    ) not valid;

alter table lck_marketplace.cook_applications
  drop constraint if exists cook_applications_proof_owned_path,
  add constraint cook_applications_proof_owned_path
    check (food_handler_certificate_url like user_id::text || '/%') not valid,
  drop constraint if exists cook_applications_permit_owned_path,
  add constraint cook_applications_permit_owned_path
    check (
      permit_or_certification_url is null
      or permit_or_certification_url like user_id::text || '/%'
    ) not valid;

-- Keep at most one active pickup window per cook/day. Normalize historical
-- duplicates before adding the invariant.
with ranked_windows as (
  select id, row_number() over (
    partition by cook_id, day_of_week
    order by updated_at desc, created_at desc, id
  ) as position
  from lck_marketplace.cook_pickup_windows
  where is_active
)
update lck_marketplace.cook_pickup_windows pickup
set is_active = false
from ranked_windows ranked
where pickup.id = ranked.id and ranked.position > 1;

create unique index if not exists cook_pickup_windows_one_active_day_idx
  on lck_marketplace.cook_pickup_windows(cook_id, day_of_week)
  where is_active;

create or replace function lck_marketplace.save_own_pickup_windows(p_windows jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = pg_catalog, lck_marketplace
as $$
declare
  window_count integer;
  distinct_day_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;
  if jsonb_typeof(p_windows) <> 'array' then
    raise exception using message = 'Pickup windows must be an array.', errcode = '22023';
  end if;

  select count(*), count(distinct input.day_of_week)
  into window_count, distinct_day_count
  from jsonb_to_recordset(p_windows) as input(
    day_of_week integer, start_time text, end_time text, is_active boolean
  );

  if window_count > 7 or distinct_day_count <> window_count then
    raise exception using message = 'Pickup windows must use unique weekdays.', errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_windows) as input(
      day_of_week integer, start_time text, end_time text, is_active boolean
    )
    where input.day_of_week not between 0 and 6
      or input.start_time is null
      or input.end_time is null
      or input.start_time::time >= input.end_time::time
      or input.is_active is null
  ) then
    raise exception using message = 'Invalid pickup window.', errcode = '22023';
  end if;

  delete from lck_marketplace.cook_pickup_windows
  where cook_id = (select auth.uid());

  insert into lck_marketplace.cook_pickup_windows (
    cook_id, day_of_week, start_time, end_time, is_active
  )
  select
    (select auth.uid()), input.day_of_week, input.start_time::time,
    input.end_time::time, input.is_active
  from jsonb_to_recordset(p_windows) as input(
    day_of_week integer, start_time text, end_time text, is_active boolean
  );
end;
$$;

revoke all on function lck_marketplace.save_own_pickup_windows(jsonb)
  from public, anon;
grant execute on function lck_marketplace.save_own_pickup_windows(jsonb)
  to authenticated;

-- Index foreign keys and common admin/public filters.
create index if not exists user_roles_active_user_role_idx
  on lck_identity.user_roles(user_id, role) where revoked_at is null;
create index if not exists user_roles_granted_by_idx
  on lck_identity.user_roles(granted_by) where granted_by is not null;
create index if not exists cook_applications_reviewed_by_idx
  on lck_marketplace.cook_applications(reviewed_by) where reviewed_by is not null;
create index if not exists cook_applications_status_submitted_idx
  on lck_marketplace.cook_applications(status, submitted_at desc);
create index if not exists cook_account_limits_updated_by_idx
  on lck_marketplace.cook_account_limits(updated_by) where updated_by is not null;
create index if not exists cook_profiles_moderator_disabled_by_idx
  on lck_marketplace.cook_profiles(moderator_disabled_by)
  where moderator_disabled_by is not null;
create index if not exists cook_menu_items_active_created_idx
  on lck_marketplace.cook_menu_items(cook_id, created_at desc) where is_active;

-- Allow users to remove superseded private application documents. Ownership is
-- still enforced by the first storage path segment.
drop policy if exists "Users can delete their cook documents" on storage.objects;
create policy "Users can delete their cook documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cook-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Draft and unapproved cook media must not be world-readable merely because a
-- URL is guessed. Published media is exposed through short-lived signed URLs.
update storage.buckets
set public = false
where id in ('cook-profile-images', 'cook-menu-images');

drop policy if exists "Anyone reads profile images" on storage.objects;
drop policy if exists "Anyone reads menu images" on storage.objects;

create policy "Owners admins and public kitchens read cook profile images"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'cook-profile-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from lck_marketplace.cook_profiles profile
        join lck_marketplace.cook_applications application
          on application.user_id = profile.cook_id
        where profile.is_public
          and application.status = 'approved'
          and (
            profile.profile_image_url = storage.objects.name
            or profile.profile_image_url like '%/cook-profile-images/' || storage.objects.name
          )
      )
    )
  );

create policy "Owners admins and public menus read cook menu images"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'cook-menu-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from lck_marketplace.cook_menu_items item
        join lck_marketplace.cook_profiles profile on profile.cook_id = item.cook_id
        join lck_marketplace.cook_applications application
          on application.user_id = item.cook_id
        where item.is_active
          and profile.is_public
          and application.status = 'approved'
          and (
            item.image_url = storage.objects.name
            or item.image_url like '%/cook-menu-images/' || storage.objects.name
          )
      )
    )
  );

create policy "Admins read private cook media"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('cook-profile-images', 'cook-menu-images')
    and (select lck_identity.current_user_is_admin())
  );

-- Trigger helpers should never be directly callable by browser roles.
revoke all on function lck_identity.handle_auth_user_change()
  from public, anon, authenticated;
revoke all on function lck_private.set_updated_at()
  from public, anon, authenticated;
revoke all on function lck_private.ensure_approved_cook_side_effects()
  from public, anon, authenticated;
revoke all on function lck_private.normalize_cook_application_user_write()
  from public, anon, authenticated;
