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

  if new.is_public then
    if not exists (
      select 1
      from lck_marketplace.cook_applications application
      where application.user_id = (select auth.uid())
        and application.status = 'approved'
    ) then
      raise exception using
        message = 'Your cook application must be approved before making your kitchen live.',
        errcode = '42501';
    end if;

    if not exists (
      select 1
      from lck_marketplace.cook_menu_items item
      where item.cook_id = (select auth.uid())
        and item.is_active
        and not item.is_sold_out
    ) then
      raise exception using
        message = 'Add at least one active, available menu item before making your kitchen live.',
        errcode = '23514';
    end if;

    if not exists (
      select 1
      from lck_marketplace.cook_pickup_windows pickup
      where pickup.cook_id = (select auth.uid())
        and pickup.is_active
    ) then
      raise exception using
        message = 'Add at least one active pickup window before making your kitchen live.',
        errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function lck_private.normalize_cook_profile_user_write()
  from public, anon, authenticated;

drop policy if exists "Cooks manage their own profile"
  on lck_marketplace.cook_profiles;
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_profiles.cook_id
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  );

drop policy if exists "Cooks manage their pickup windows"
  on lck_marketplace.cook_pickup_windows;
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_pickup_windows.cook_id
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  );

drop policy if exists "Cooks manage their menu items"
  on lck_marketplace.cook_menu_items;
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  )
  with check (
    (select auth.uid()) = cook_id
    and exists (
      select 1
      from lck_marketplace.cook_applications app
      where app.user_id = cook_menu_items.cook_id
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  );

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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
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
        and app.status in ('draft', 'submitted', 'rejected', 'approved')
    )
  );
