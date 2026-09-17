-- Supabase setup for private SNS content photos.
-- Run from the Supabase SQL editor as a project owner, then insert the
-- allowed administrator's auth user id into public.photo_owners.

create table if not exists public.photo_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.photo_owners enable row level security;
alter table public.photo_owners force row level security;

revoke all on public.photo_owners from anon;
revoke all on public.photo_owners from authenticated;
grant select on public.photo_owners to authenticated;

drop policy if exists "photo owners can read own allowlist row" on public.photo_owners;
create policy "photo owners can read own allowlist row"
on public.photo_owners
for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-photos',
  'content-photos',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content photos owner read" on storage.objects;
drop policy if exists "content photos owner insert" on storage.objects;
drop policy if exists "content photos owner delete" on storage.objects;

create policy "content photos owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'content-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.photo_owners
    where user_id = auth.uid()
  )
);

create policy "content photos owner insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.photo_owners
    where user_id = auth.uid()
  )
);

create policy "content photos owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'content-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.photo_owners
    where user_id = auth.uid()
  )
);
