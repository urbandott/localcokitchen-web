-- Account profile fields are private and owner-managed. Keep the identity row
-- protected by RLS and grant only the columns customers are allowed to edit.
alter table lck_identity.users
  drop constraint if exists users_first_name_length,
  add constraint users_first_name_length
    check (first_name is null or char_length(btrim(first_name)) between 1 and 80) not valid,
  drop constraint if exists users_last_name_length,
  add constraint users_last_name_length
    check (last_name is null or char_length(btrim(last_name)) between 1 and 80) not valid,
  drop constraint if exists users_full_name_length,
  add constraint users_full_name_length
    check (full_name is null or char_length(btrim(full_name)) between 1 and 161) not valid;

-- Historical auth metadata could contain a non-owned avatar path. Do not carry
-- that unsafe reference into the new owner-managed upload flow.
update lck_identity.users
set avatar_path = null
where avatar_path is not null
  and avatar_path not like id::text || '/%';

alter table lck_identity.users
  drop constraint if exists users_avatar_owned_path,
  add constraint users_avatar_owned_path
    check (avatar_path is null or avatar_path like id::text || '/%');

drop policy if exists "Users can update their own identity profile"
  on lck_identity.users;
create policy "Users can update their own identity profile"
  on lck_identity.users
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update on lck_identity.users from authenticated;
grant update (first_name, last_name, full_name, avatar_path)
  on lck_identity.users
  to authenticated;

-- Account images are private. The existing object policies restrict reads,
-- inserts, updates, and deletes to the authenticated user's UUID folder.
update storage.buckets
set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';
