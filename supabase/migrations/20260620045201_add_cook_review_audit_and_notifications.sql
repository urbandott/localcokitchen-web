create table if not exists lck_private.cook_application_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lck_identity.users(id) on delete cascade,
  previous_status text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  review_notes text,
  reviewed_by uuid not null references lck_identity.users(id),
  reviewed_at timestamptz not null,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'processing', 'sent', 'failed')),
  notification_attempts integer not null default 0 check (notification_attempts >= 0),
  notification_provider_id text,
  notification_error text,
  notification_sent_at timestamptz,
  notification_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cook_application_reviews_user_id_idx
  on lck_private.cook_application_reviews(user_id, reviewed_at desc);
create index if not exists cook_application_reviews_notification_queue_idx
  on lck_private.cook_application_reviews(notification_status, notification_updated_at)
  where notification_status in ('pending', 'processing', 'failed');

alter table lck_private.cook_application_reviews enable row level security;
revoke all on table lck_private.cook_application_reviews from public, anon, authenticated;
grant usage on schema lck_identity to service_role;

create or replace function lck_private.record_cook_application_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
declare
  decision_reviewer uuid := coalesce(new.reviewed_by, (select auth.uid()));
begin
  if new.status = old.status or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  if decision_reviewer is null then
    raise exception using message = 'Cook application decisions require a reviewer.', errcode = '23502';
  end if;

  insert into lck_private.cook_application_reviews (
    user_id, previous_status, decision, review_notes, reviewed_by, reviewed_at
  )
  values (
    new.user_id,
    old.status,
    new.status,
    new.review_notes,
    decision_reviewer,
    coalesce(new.reviewed_at, now())
  );

  if old.status = 'approved' and new.status = 'rejected' then
    update lck_identity.user_roles
    set revoked_at = now()
    where user_id = new.user_id
      and role = 'cook'
      and revoked_at is null;

    update lck_marketplace.cook_profiles
    set is_public = false
    where cook_id = new.user_id;

    -- Retain profiles, menus, pickup windows, limits, documents, and images.
    -- Existing RLS hides them while the application is not approved.
  end if;

  return new;
end;
$$;

revoke all on function lck_private.record_cook_application_decision() from public, anon, authenticated;

drop trigger if exists record_cook_application_decision on lck_marketplace.cook_applications;
create trigger record_cook_application_decision
  after update of status on lck_marketplace.cook_applications
  for each row execute function lck_private.record_cook_application_decision();

create or replace function lck_identity.get_cook_application_review_history()
returns table (
  review_id uuid,
  user_id uuid,
  previous_status text,
  decision text,
  review_notes text,
  reviewed_by uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  notification_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
begin
  if not lck_identity.current_user_is_admin() then
    raise exception using message = 'Admin access required.', errcode = '42501';
  end if;

  return query
  select
    review.id,
    review.user_id,
    review.previous_status,
    review.decision,
    review.review_notes,
    review.reviewed_by,
    coalesce(nullif(reviewer.full_name, ''), reviewer.email),
    review.reviewed_at,
    review.notification_status
  from lck_private.cook_application_reviews review
  join lck_identity.users reviewer on reviewer.id = review.reviewed_by
  order by review.reviewed_at desc;
end;
$$;

revoke all on function lck_identity.get_cook_application_review_history() from public, anon;
grant execute on function lck_identity.get_cook_application_review_history() to authenticated;

create or replace function lck_identity.claim_pending_cook_review_notifications(batch_size integer default 20)
returns table (
  review_id uuid,
  recipient_email text,
  recipient_name text,
  decision text,
  review_notes text,
  reviewed_at timestamptz
)
language sql
volatile
security definer
set search_path = pg_catalog, lck_private, lck_identity
as $$
  with candidates as (
    select review.id
    from lck_private.cook_application_reviews review
    where review.notification_attempts < 5
      and (
        review.notification_status in ('pending', 'failed')
        or (
          review.notification_status = 'processing'
          and review.notification_updated_at < now() - interval '10 minutes'
        )
      )
    order by review.created_at
    limit greatest(1, least(coalesce(batch_size, 20), 50))
    for update skip locked
  ),
  claimed as (
    update lck_private.cook_application_reviews review
    set
      notification_status = 'processing',
      notification_attempts = review.notification_attempts + 1,
      notification_error = null,
      notification_updated_at = now()
    from candidates
    where review.id = candidates.id
    returning review.id, review.user_id, review.decision, review.review_notes, review.reviewed_at
  )
  select
    claimed.id,
    account.email,
    coalesce(nullif(account.full_name, ''), nullif(account.first_name, ''), 'LocalCoKitchen cook'),
    claimed.decision,
    claimed.review_notes,
    claimed.reviewed_at
  from claimed
  join lck_identity.users account on account.id = claimed.user_id;
$$;

revoke all on function lck_identity.claim_pending_cook_review_notifications(integer)
  from public, anon, authenticated;
grant execute on function lck_identity.claim_pending_cook_review_notifications(integer)
  to service_role;

create or replace function lck_identity.complete_cook_review_notification(
  p_review_id uuid,
  p_succeeded boolean,
  p_provider_id text default null,
  p_error_message text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, lck_private
as $$
begin
  update lck_private.cook_application_reviews review
  set
    notification_status = case when p_succeeded then 'sent' else 'failed' end,
    notification_provider_id = case when p_succeeded then nullif(p_provider_id, '') else null end,
    notification_error = case
      when p_succeeded then null
      else left(coalesce(nullif(p_error_message, ''), 'Unknown email delivery error.'), 1000)
    end,
    notification_sent_at = case when p_succeeded then now() else null end,
    notification_updated_at = now()
  where review.id = p_review_id
    and review.notification_status = 'processing';
end;
$$;

revoke all on function lck_identity.complete_cook_review_notification(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function lck_identity.complete_cook_review_notification(uuid, boolean, text, text)
  to service_role;
