-- Row Level Security: household sharing is "just an RLS policy" (build plan §5).
-- Every instance table is scoped to the caller's household; the two global
-- catalog tables are world-readable but admin-only for writes.

-- Helper: the household_id of the currently authenticated user.
create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from users where id = auth.uid();
$$;

alter table households        enable row level security;
alter table users             enable row level security;
alter table user_cards        enable row level security;
alter table benefits          enable row level security;
alter table points_accounts   enable row level security;
alter table card_catalog      enable row level security;
alter table program_reference enable row level security;

-- households: members can see/update their own household.
create policy households_select on households
  for select using (id = current_household_id());
create policy households_update on households
  for update using (id = current_household_id());

-- users: visible to everyone in the same household.
create policy users_select on users
  for select using (household_id = current_household_id());
create policy users_insert_self on users
  for insert with check (id = auth.uid());
create policy users_update_self on users
  for update using (id = auth.uid());

-- user_cards: scoped via the owning user's household.
create policy user_cards_all on user_cards
  for all using (
    user_id in (select id from users where household_id = current_household_id())
  )
  with check (
    user_id in (select id from users where household_id = current_household_id())
  );

-- benefits: scoped via the parent user_card's household.
create policy benefits_all on benefits
  for all using (
    user_card_id in (
      select uc.id from user_cards uc
      join users u on u.id = uc.user_id
      where u.household_id = current_household_id()
    )
  )
  with check (
    user_card_id in (
      select uc.id from user_cards uc
      join users u on u.id = uc.user_id
      where u.household_id = current_household_id()
    )
  );

-- points_accounts: scoped via the owning user's household.
create policy points_accounts_all on points_accounts
  for all using (
    user_id in (select id from users where household_id = current_household_id())
  )
  with check (
    user_id in (select id from users where household_id = current_household_id())
  );

-- Global tables: readable by any authenticated user, writable by admin only
-- (service role bypasses RLS, so no write policy is exposed to clients).
create policy card_catalog_read on card_catalog
  for select using (auth.role() = 'authenticated');
create policy program_reference_read on program_reference
  for select using (auth.role() = 'authenticated');
