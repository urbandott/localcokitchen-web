create or replace function lck_identity.get_admin_metrics()
returns table (
  total_cook_applicants bigint,
  live_kitchens bigint,
  inactive_cook_pipeline bigint,
  pending_applications bigint,
  approved_not_live bigint,
  rejected_applications bigint,
  suspended_cooks bigint,
  customer_visible_menu_items bigint,
  sold_out_menu_items bigint,
  live_pickup_windows bigint,
  applications_last_7_days bigint,
  generated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, lck_identity, lck_marketplace
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using
      message = 'Admin access required.',
      errcode = '42501';
  end if;

  return query
  with application_metrics as (
    select
      count(*) as total_cook_applicants,
      count(*) filter (
        where application.status = 'approved'
          and coalesce(profile.is_public, false)
      ) as live_kitchens,
      count(*) filter (
        where not (
          application.status = 'approved'
          and coalesce(profile.is_public, false)
        )
      ) as inactive_cook_pipeline,
      count(*) filter (where application.status = 'submitted') as pending_applications,
      count(*) filter (
        where application.status = 'approved'
          and not coalesce(profile.is_public, false)
      ) as approved_not_live,
      count(*) filter (where application.status = 'rejected') as rejected_applications,
      count(*) filter (where application.status = 'suspended') as suspended_cooks,
      count(*) filter (where application.created_at >= now() - interval '7 days')
        as applications_last_7_days
    from lck_marketplace.cook_applications application
    left join lck_marketplace.cook_profiles profile
      on profile.cook_id = application.user_id
  ),
  menu_metrics as (
    select
      count(*) filter (where item.is_active) as customer_visible_menu_items,
      count(*) filter (where item.is_active and item.is_sold_out) as sold_out_menu_items
    from lck_marketplace.cook_menu_items item
    join lck_marketplace.cook_profiles profile
      on profile.cook_id = item.cook_id
      and profile.is_public
    join lck_marketplace.cook_applications application
      on application.user_id = item.cook_id
      and application.status = 'approved'
  ),
  pickup_metrics as (
    select count(*) filter (where pickup.is_active) as live_pickup_windows
    from lck_marketplace.cook_pickup_windows pickup
    join lck_marketplace.cook_profiles profile
      on profile.cook_id = pickup.cook_id
      and profile.is_public
    join lck_marketplace.cook_applications application
      on application.user_id = pickup.cook_id
      and application.status = 'approved'
  )
  select
    application_metrics.total_cook_applicants,
    application_metrics.live_kitchens,
    application_metrics.inactive_cook_pipeline,
    application_metrics.pending_applications,
    application_metrics.approved_not_live,
    application_metrics.rejected_applications,
    application_metrics.suspended_cooks,
    menu_metrics.customer_visible_menu_items,
    menu_metrics.sold_out_menu_items,
    pickup_metrics.live_pickup_windows,
    application_metrics.applications_last_7_days,
    now()
  from application_metrics
  cross join menu_metrics
  cross join pickup_metrics;
end;
$$;

revoke all on function lck_identity.get_admin_metrics() from public, anon;
grant execute on function lck_identity.get_admin_metrics() to authenticated;
