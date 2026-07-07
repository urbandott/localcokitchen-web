drop policy if exists "Cooks delete profile images" on storage.objects;
create policy "Cooks delete profile images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'cook-profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Cooks delete menu images" on storage.objects;
create policy "Cooks delete menu images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'cook-menu-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
