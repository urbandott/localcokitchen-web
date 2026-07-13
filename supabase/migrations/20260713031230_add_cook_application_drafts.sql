alter table lck_marketplace.cook_applications
  alter column legal_name drop not null,
  alter column phone drop not null,
  alter column pickup_address drop not null,
  alter column pickup_zip_code drop not null,
  alter column food_handler_certificate_url drop not null,
  alter column submitted_at drop not null;

alter table lck_marketplace.cook_applications
  drop constraint if exists cook_applications_training_required,
  drop constraint if exists cook_applications_legal_name_length,
  drop constraint if exists cook_applications_phone_us_format,
  drop constraint if exists cook_applications_pickup_address_length,
  drop constraint if exists cook_applications_zip_length,
  drop constraint if exists cook_applications_submission_documents_required,
  add constraint cook_applications_submission_required_fields
    check (
      status = 'draft'
      or (
        char_length(btrim(coalesce(legal_name, ''))) between 2 and 120
        and phone ~ '^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$'
        and char_length(btrim(coalesce(pickup_address, ''))) between 8 and 240
        and pickup_zip_code ~ '^[0-9]{5}$'
        and food_handler_training_completed is true
        and food_handler_certificate_url is not null
        and government_id_document_url is not null
        and selfie_verification_url is not null
        and submitted_at is not null
      )
    ),
  add constraint cook_applications_draft_field_format
    check (
      (legal_name is null or char_length(btrim(legal_name)) between 2 and 120)
      and (phone is null or phone ~ '^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$')
      and (pickup_address is null or char_length(btrim(pickup_address)) between 8 and 240)
      and (pickup_zip_code is null or pickup_zip_code ~ '^[0-9]{5}$')
    );

create or replace function lck_private.normalize_cook_application_user_write()
returns trigger
language plpgsql
security definer
set search_path = lck_marketplace, lck_identity, public
as $$
begin
  if lck_identity.current_user_has_admin_role() then
    return new;
  end if;

  new.user_id := auth.uid();
  if new.status not in ('draft', 'submitted') then
    new.status := 'submitted';
  end if;

  if new.status = 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
  else
    new.submitted_at := null;
  end if;

  new.reviewed_at := null;
  new.reviewed_by := null;
  new.review_notes := null;

  return new;
end;
$$;

drop policy if exists "Users can submit their own cook application"
  on lck_marketplace.cook_applications;
create policy "Users can create their own cook application draft or submission"
  on lck_marketplace.cook_applications
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status in ('draft', 'submitted')
  );

drop policy if exists "Users can update and resubmit their cook application"
  on lck_marketplace.cook_applications;
create policy "Users can update draft or rejected cook applications"
  on lck_marketplace.cook_applications
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status in ('draft', 'rejected')
  )
  with check (
    (select auth.uid()) = user_id
    and status in ('draft', 'submitted')
  );
