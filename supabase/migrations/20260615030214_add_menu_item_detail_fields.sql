create or replace function lck_private.text_array_items_within(
  tag_values text[],
  max_items integer,
  max_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(coalesce(tag_values, '{}')) <= max_items
    and coalesce(
      (
        select bool_and(char_length(btrim(item)) between 1 and max_length)
        from unnest(coalesce(tag_values, '{}')) as tag(item)
      ),
      true
    );
$$;

alter table lck_marketplace.cook_menu_items
  add column if not exists category_tags text[] not null default '{}',
  add column if not exists portion_serves integer not null default 1,
  add column if not exists spice_level text not null default 'Not spicy',
  add column if not exists main_ingredients text[] not null default '{}';

alter table lck_marketplace.cook_menu_items
  drop column if exists allergens;

alter table lck_marketplace.cook_menu_items
  drop column if exists item_tags,
  drop constraint if exists cook_menu_items_item_tags_limit,
  drop constraint if exists cook_menu_items_category_tags_limit,
  add constraint cook_menu_items_category_tags_limit
    check (lck_private.text_array_items_within(category_tags, 5, 15)),
  drop constraint if exists cook_menu_items_dietary_tags_limit,
  add constraint cook_menu_items_dietary_tags_limit
    check (lck_private.text_array_items_within(dietary_tags, 10, 40)),
  drop constraint if exists cook_menu_items_main_ingredients_limit,
  add constraint cook_menu_items_main_ingredients_limit
    check (lck_private.text_array_items_within(main_ingredients, 20, 60)),
  drop constraint if exists cook_menu_items_portion_size_length,
  drop constraint if exists cook_menu_items_portion_serves_range,
  add constraint cook_menu_items_portion_serves_range
    check (portion_serves between 1 and 50),
  drop constraint if exists cook_menu_items_spice_level_allowed,
  add constraint cook_menu_items_spice_level_allowed
    check (spice_level in ('Not spicy', 'Mild', 'Medium', 'Hot', 'Extra hot'));
