alter table lck_marketplace.cook_applications
  add column if not exists government_id_document_url text,
  add column if not exists selfie_verification_url text;

alter table lck_marketplace.cook_applications
  drop constraint if exists cook_applications_government_id_owned_path,
  add constraint cook_applications_government_id_owned_path
    check (
      government_id_document_url is null
      or government_id_document_url like user_id::text || '/%'
    ) not valid,
  drop constraint if exists cook_applications_selfie_owned_path,
  add constraint cook_applications_selfie_owned_path
    check (
      selfie_verification_url is null
      or selfie_verification_url like user_id::text || '/%'
    ) not valid,
  drop constraint if exists cook_applications_submission_documents_required,
  add constraint cook_applications_submission_documents_required
    check (
      status in ('draft', 'approved', 'rejected', 'suspended')
      or (
        government_id_document_url is not null
        and selfie_verification_url is not null
        and food_handler_certificate_url is not null
      )
    ) not valid;
