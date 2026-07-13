alter table lck_marketplace.cook_menu_items
  add column if not exists image_names text[] not null default '{}'::text[];

update lck_marketplace.cook_menu_items
set image_names = (
  select array_agg(coalesce(nullif(split_part(path, '/', array_length(string_to_array(path, '/'), 1)), ''), 'Menu item photo') order by ordinality)
  from unnest(
    case
      when coalesce(cardinality(image_urls), 0) > 0 then image_urls
      else array[image_url]
    end
  ) with ordinality as image_path(path, ordinality)
)
where coalesce(cardinality(image_names), 0) = 0;

alter table lck_marketplace.cook_menu_items
  drop constraint if exists cook_menu_items_image_names_count,
  add constraint cook_menu_items_image_names_count
    check (cardinality(image_names) = cardinality(image_urls)) not valid;

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
  p_categories text[] default '{}'::text[],
  p_dietary_tags text[] default '{}'::text[],
  p_excluded_allergens text[] default '{}'::text[],
  p_cuisine_types text[] default '{}'::text[],
  p_spice_levels text[] default '{}'::text[],
  p_cook_ids uuid[] default '{}'::uuid[],
  p_item_ids uuid[] default '{}'::uuid[],
  p_min_quantity integer default 1,
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
  image_names text[],
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
    item.image_names,
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
    (
      select count(*)
      from lck_marketplace.cook_menu_items count_item
      where count_item.cook_id = item.cook_id
        and count_item.is_active
        and not count_item.is_sold_out
        and count_item.quantity_available > 0
    ) as cook_public_menu_count,
    item.created_at
  from normalized n
  join lck_marketplace.cook_menu_items item on true
  join lck_marketplace.cook_profiles profile
    on profile.cook_id = item.cook_id
  join lck_marketplace.cook_applications application
    on application.user_id = item.cook_id
  where item.is_active
    and not item.is_sold_out
    and item.quantity_available >= n.min_quantity
    and profile.is_public
    and profile.moderator_disabled_at is null
    and application.status = 'approved'
    and (cardinality(n.item_ids) = 0 or item.id = any(n.item_ids))
    and (cardinality(n.cook_ids) = 0 or item.cook_id = any(n.cook_ids))
    and (cardinality(n.categories) = 0 or item.category = any(n.categories))
    and (cardinality(n.dietary_tags) = 0 or item.dietary_tags && n.dietary_tags)
    and (cardinality(n.excluded_allergens) = 0 or not (item.allergens && n.excluded_allergens))
    and (cardinality(n.cuisine_types) = 0 or profile.cuisine_type = any(n.cuisine_types))
    and (cardinality(n.spice_levels) = 0 or item.spice_level = any(n.spice_levels))
    and (
      n.search_text is null
      or lower(item.name) like '%' || n.search_text || '%'
      or lower(item.description) like '%' || n.search_text || '%'
      or lower(item.category) like '%' || n.search_text || '%'
      or lower(profile.display_name) like '%' || n.search_text || '%'
      or lower(coalesce(profile.cuisine_type, '')) like '%' || n.search_text || '%'
      or exists (
        select 1
        from unnest(item.dietary_tags || item.main_ingredients) as token(value)
        where lower(token.value) like '%' || n.search_text || '%'
      )
    )
  order by item.created_at desc
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
