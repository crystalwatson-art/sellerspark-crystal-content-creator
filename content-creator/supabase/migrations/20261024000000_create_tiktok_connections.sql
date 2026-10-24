-- Prepared for the separate SellerSpark development project only.
-- Apply only after Crystal approves the token-storage schema and deployment configuration.
-- token_blob is application-encrypted; do not store plaintext TikTok tokens.

create table if not exists public.sellerspark_tiktok_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token_blob jsonb not null,
  granted_scopes text[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(token_blob) = 'object'),
  check (updated_at >= created_at)
);

alter table public.sellerspark_tiktok_connections enable row level security;
alter table public.sellerspark_tiktok_connections force row level security;

revoke all on table public.sellerspark_tiktok_connections from anon;
revoke all on table public.sellerspark_tiktok_connections from authenticated;
grant select, insert, update, delete on table public.sellerspark_tiktok_connections to authenticated;

create policy "SellerSpark owners can read TikTok connections"
  on public.sellerspark_tiktok_connections
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id);

create policy "SellerSpark owners can create TikTok connections"
  on public.sellerspark_tiktok_connections
  for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "SellerSpark owners can update TikTok connections"
  on public.sellerspark_tiktok_connections
  for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id)
  with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "SellerSpark owners can delete TikTok connections"
  on public.sellerspark_tiktok_connections
  for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id);
