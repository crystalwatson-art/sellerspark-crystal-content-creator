-- Prepared for the separate SellerSpark development project only.
-- Apply only after Crystal approves the schema and auth contract.

create table if not exists public.sellerspark_listing_reviews (
  id text primary key
    check (id ~ '^review-[0-9a-f-]{36}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  brief jsonb not null,
  research_verification jsonb,
  listing_review jsonb not null,
  check (updated_at >= created_at)
);

create index if not exists sellerspark_listing_reviews_owner_id_idx
  on public.sellerspark_listing_reviews (owner_id, updated_at desc);

alter table public.sellerspark_listing_reviews enable row level security;
alter table public.sellerspark_listing_reviews force row level security;

revoke all on table public.sellerspark_listing_reviews from anon;
revoke all on table public.sellerspark_listing_reviews from authenticated;
grant select, insert, update on table public.sellerspark_listing_reviews to authenticated;

create policy "SellerSpark owners can read their reviews"
  on public.sellerspark_listing_reviews
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id);

create policy "SellerSpark owners can create their reviews"
  on public.sellerspark_listing_reviews
  for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "SellerSpark owners can update their reviews"
  on public.sellerspark_listing_reviews
  for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id)
  with check (auth.uid() is not null and auth.uid() = owner_id);
