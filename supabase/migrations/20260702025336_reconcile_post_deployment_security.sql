-- The platform event trigger must remain callable by PostgreSQL itself, but it
-- must not be exposed as a browser-callable SECURITY DEFINER RPC.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end
$$;

-- Pin the search path for the generic trigger helper. It only needs pg_catalog
-- for now(), and callers must not be able to influence object resolution.
alter function lck_private.set_updated_at()
  set search_path = pg_catalog;
revoke all on function lck_private.set_updated_at()
  from public, anon, authenticated;

-- Public buckets already serve objects through public URLs. A broad SELECT
-- policy additionally permits listing every account image through the API.
drop policy if exists "Anyone reads account profile images"
  on storage.objects;
drop policy if exists "Users read their own account profile images"
  on storage.objects;
create policy "Users read their own account profile images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- These checks were introduced as NOT VALID so the production migration could
-- deploy without long table locks. Reconciliation confirmed there are no
-- violating cook rows, so validate them and restore the baseline NOT NULL
-- invariant for menu categories.
alter table lck_marketplace.cook_applications
  validate constraint cook_applications_proof_owned_path,
  validate constraint cook_applications_permit_owned_path;

alter table lck_marketplace.cook_profiles
  validate constraint cook_profiles_display_name_length,
  validate constraint cook_profiles_cuisine_type_length,
  validate constraint cook_profiles_order_notes_length,
  validate constraint cook_profiles_image_owned_path;

alter table lck_marketplace.cook_menu_items
  validate constraint cook_menu_items_price_cents_check,
  validate constraint cook_menu_items_quantity_available_check,
  validate constraint cook_menu_items_category_length,
  validate constraint cook_menu_items_allergens_limit,
  validate constraint cook_menu_items_allergens_none_exclusive,
  validate constraint cook_menu_items_active_ingredients_required,
  validate constraint cook_menu_items_active_allergens_required,
  validate constraint cook_menu_items_image_owned_path;

alter table lck_marketplace.cook_menu_items
  alter column category set not null;
