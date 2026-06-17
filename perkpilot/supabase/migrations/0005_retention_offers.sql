-- Retention-offer crowdsourcing (build plan §10, idea #2). Unlike the other
-- instance tables, reports are READABLE by every authenticated user so the app
-- can aggregate them — but each user can only insert/modify their own rows.
-- No PII is exposed by the read policy (no names/emails on this table).

create type retention_outcome   as enum ('kept', 'downgraded', 'canceled');
create type retention_channel   as enum ('phone', 'chat', 'app');
create type retention_offer_type as enum ('points', 'statement_credit', 'fee_waiver', 'spend_bonus', 'none');

create table retention_offers (
  id              uuid primary key default gen_random_uuid(),
  catalog_id      uuid not null references card_catalog (id),
  user_id         uuid not null references users (id) on delete cascade,
  reported_at     date not null default current_date,
  channel         retention_channel not null,
  offer_type      retention_offer_type not null,
  points_offered  integer,
  value_usd       numeric,
  spend_required  numeric,
  note            text,
  outcome         retention_outcome not null
);
create index retention_offers_catalog_idx on retention_offers (catalog_id);

alter table retention_offers enable row level security;

-- Aggregate reads: any authenticated user can read all reports.
create policy retention_read on retention_offers
  for select using (auth.role() = 'authenticated');

-- Writes: only for your own user_id.
create policy retention_insert on retention_offers
  for insert with check (user_id = auth.uid());
create policy retention_update on retention_offers
  for update using (user_id = auth.uid());
create policy retention_delete on retention_offers
  for delete using (user_id = auth.uid());
