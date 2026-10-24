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
grant select, insert, update, delete on table public.sellerspark_tiktok_connections to service_role;

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

-- OAuth state is server-only, short-lived, and consumed atomically by the
-- server-side service-role adapter. The raw state is never stored.
create table if not exists public.sellerspark_tiktok_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create index if not exists sellerspark_tiktok_oauth_states_expires_at_idx
  on public.sellerspark_tiktok_oauth_states (expires_at);

alter table public.sellerspark_tiktok_oauth_states enable row level security;
alter table public.sellerspark_tiktok_oauth_states force row level security;

revoke all on table public.sellerspark_tiktok_oauth_states from anon;
revoke all on table public.sellerspark_tiktok_oauth_states from authenticated;
grant select, insert, update, delete on table public.sellerspark_tiktok_oauth_states to service_role;
