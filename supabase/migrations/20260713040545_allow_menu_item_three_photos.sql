alter table lck_marketplace.cook_menu_items
  add column if not exists image_urls text[] not null default '{}'::text[];

update lck_marketplace.cook_menu_items
set image_urls = array[image_url]
where coalesce(cardinality(image_urls), 0) = 0
  and image_url is not null;

alter table lck_marketplace.cook_menu_items
  drop constraint if exists cook_menu_items_image_urls_count,
  add constraint cook_menu_items_image_urls_count
    check (cardinality(image_urls) between 1 and 3) not valid,
  drop constraint if exists cook_menu_items_image_urls_owned_paths,
  add constraint cook_menu_items_image_urls_owned_paths
    check (
      image_urls[1] is not null
      and (
        image_urls[1] like cook_id::text || '/%'
        or image_urls[1] like '%/cook-menu-images/' || cook_id::text || '/%'
      )
      and (
        image_urls[2] is null
        or image_urls[2] like cook_id::text || '/%'
        or image_urls[2] like '%/cook-menu-images/' || cook_id::text || '/%'
      )
      and (
        image_urls[3] is null
        or image_urls[3] like cook_id::text || '/%'
        or image_urls[3] like '%/cook-menu-images/' || cook_id::text || '/%'
      )
    ) not valid,
  drop constraint if exists cook_menu_items_image_url_first_image,
  add constraint cook_menu_items_image_url_first_image
    check (image_url = image_urls[1]) not valid;

drop function if exists lck_marketplace.get_customer_menu_items(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  uuid[],
  uuid[],
  integer,
  integer,
  integer
);

create or replace function lck_marketplace.get_customer_menu_items(
  p_search text default null,
  p_categories text[] default '{}',
  p_dietary_tags text[] default '{}',
  p_excluded_allergens text[] default '{}',
  p_cuisine_types text[] default '{}',
  p_spice_levels text[] default '{}',
  p_cook_ids uuid[] default '{}',
  p_item_ids uuid[] default '{}',
  p_min_quantity integer default null,
  p_limit integer default 48,
  p_offset integer default 0
)
returns table (
  id uuid,
  cook_id uuid,
  name text,
  description text,
  image_url text,
  image_urls text[],
  price_cents integer,
  quantity_available integer,
  category text,
  allergens text[],
  dietary_tags text[],
  main_ingredients text[],
  portion_size text,
  portion_serves integer,
  spice_level text,
  pickup_window_note text,
  cook_display_name text,
  cook_profile_image_url text,
  cook_description text,
  cook_cuisine_type text,
  cook_order_notes text,
  cook_rating numeric,
  cook_review_count integer,
  cook_public_menu_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, lck_marketplace
as $$
  with normalized as (
    select
      nullif(btrim(regexp_replace(lower(coalesce(p_search, '')), '\s+', ' ', 'g')), '') as search_text,
      coalesce(p_categories, '{}'::text[]) as categories,
      coalesce(p_dietary_tags, '{}'::text[]) as dietary_tags,
      coalesce(p_excluded_allergens, '{}'::text[]) as excluded_allergens,
      coalesce(p_cuisine_types, '{}'::text[]) as cuisine_types,
      coalesce(p_spice_levels, '{}'::text[]) as spice_levels,
      coalesce(p_cook_ids, '{}'::uuid[]) as cook_ids,
      coalesce(p_item_ids, '{}'::uuid[]) as item_ids,
      greatest(coalesce(p_min_quantity, 1), 1) as min_quantity,
      least(greatest(coalesce(p_limit, 48), 1), 96) as row_limit,
      greatest(coalesce(p_offset, 0), 0) as row_offset
  )
  select
    item.id,
    item.cook_id,
    item.name,
    item.description,
    item.image_url,
    item.image_urls,
    item.price_cents,
    item.quantity_available,
    item.category,
    item.allergens,
    item.dietary_tags,
    item.main_ingredients,
    item.portion_size,
    item.portion_serves,
    item.spice_level,
    item.pickup_window_note,
    profile.display_name as cook_display_name,
    profile.profile_image_url as cook_profile_image_url,
    profile.description as cook_description,
    profile.cuisine_type as cook_cuisine_type,
    profile.order_notes as cook_order_notes,
    profile.rating as cook_rating,
    profile.review_count as cook_review_count,
    public_counts.public_menu_count as cook_public_menu_count,
    item.created_at
  from normalized input
  join lck_marketplace.cook_menu_items item on true
  join lck_marketplace.cook_profiles profile
    on profile.cook_id = item.cook_id
  join lck_marketplace.cook_applications application
    on application.user_id = item.cook_id
   and application.status = 'approved'
  cross join lateral (
    select count(*)::bigint as public_menu_count
    from lck_marketplace.cook_menu_items count_item
    where count_item.cook_id = item.cook_id
      and count_item.is_active
      and not count_item.is_sold_out
      and count_item.quantity_available > 0
  ) public_counts
  where item.is_active
    and not item.is_sold_out
    and item.quantity_available > 0
    and profile.is_public
    and profile.moderator_disabled_at is null
    and item.quantity_available >= input.min_quantity
    and (cardinality(input.item_ids) = 0 or item.id = any(input.item_ids))
    and (cardinality(input.cook_ids) = 0 or item.cook_id = any(input.cook_ids))
    and (
      cardinality(input.categories) = 0
      or lower(item.category) = any(select lower(category_filter) from unnest(input.categories) category_filter)
    )
    and (
      cardinality(input.dietary_tags) = 0
      or item.dietary_tags @> input.dietary_tags
    )
    and (
      cardinality(input.excluded_allergens) = 0
      or not (item.allergens && input.excluded_allergens)
    )
    and (
      cardinality(input.cuisine_types) = 0
      or lower(profile.cuisine_type) = any(select lower(cuisine_filter) from unnest(input.cuisine_types) cuisine_filter)
    )
    and (
      cardinality(input.spice_levels) = 0
      or lower(coalesce(item.spice_level, '')) = any(select lower(spice_filter) from unnest(input.spice_levels) spice_filter)
    )
    and (
      input.search_text is null
      or not exists (
        select 1
        from unnest(regexp_split_to_array(input.search_text, ' ')) as terms(search_term)
        where not (
          lower(item.name) like '%' || search_term || '%'
          or lower(item.description) like '%' || search_term || '%'
          or lower(item.category) like '%' || search_term || '%'
          or lower(profile.display_name) like '%' || search_term || '%'
          or lower(coalesce(profile.cuisine_type, '')) like '%' || search_term || '%'
          or exists (
            select 1 from unnest(item.dietary_tags) tag
            where lower(tag) like '%' || search_term || '%'
          )
          or exists (
            select 1 from unnest(item.main_ingredients) ingredient
            where lower(ingredient) like '%' || search_term || '%'
          )
        )
      )
    )
  order by item.created_at desc, item.id
  limit (select row_limit from normalized)
  offset (select row_offset from normalized);
$$;

revoke all on function lck_marketplace.get_customer_menu_items(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  uuid[],
  uuid[],
  integer,
  integer,
  integer
) from public;

grant execute on function lck_marketplace.get_customer_menu_items(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  uuid[],
  uuid[],
  integer,
  integer,
  integer
) to anon, authenticated;

drop policy if exists "Owners admins and public menus read cook menu images" on storage.objects;
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
            or storage.objects.name = any(item.image_urls)
            or exists (
              select 1
              from unnest(item.image_urls) as image_path(path)
              where image_path.path like '%/cook-menu-images/' || storage.objects.name
            )
          )
      )
    )
  );
