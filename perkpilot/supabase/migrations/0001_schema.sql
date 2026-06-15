-- PerkPilot schema (build plan §3). The card_catalog and program_reference
-- tables are the product; everything else is per-household instance data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type household_role     as enum ('owner', 'member');
create type card_network       as enum ('visa', 'mastercard', 'amex', 'discover');
create type catalog_status     as enum ('active', 'discontinued', 'application_paused');
create type benefit_type       as enum ('free_night_cert', 'statement_credit', 'lounge', 'companion_pass', 'other');
create type reset_cycle        as enum ('annual', 'calendar_year', 'cardmember_year', 'one_time');
create type user_card_status   as enum ('open', 'closed', 'product_changed');
create type expiration_policy  as enum ('inactivity_months', 'hard_date', 'none');
create type points_account_type as enum ('loyalty', 'vacation_club');
create type pricing_model      as enum ('fixed_chart', 'dynamic', 'revenue_based');

-- ---------------------------------------------------------------------------
-- Households + users
-- ---------------------------------------------------------------------------
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- users.id == auth.uid()
create table users (
  id            uuid primary key references auth.users (id) on delete cascade,
  household_id  uuid not null references households (id) on delete cascade,
  display_name  text not null,
  email         text not null,
  role          household_role not null default 'member'
);
create index users_household_idx on users (household_id);

-- ---------------------------------------------------------------------------
-- Global catalog (admin-maintained) — the benefits database
-- ---------------------------------------------------------------------------
create table card_catalog (
  id                uuid primary key default gen_random_uuid(),
  issuer            text not null,
  product_name      text not null,
  network           card_network not null,
  annual_fee        numeric not null default 0,
  referral_url      text,
  referral_active   boolean not null default false,
  earn_rates        jsonb not null default '{}'::jsonb,   -- category -> multiplier
  benefits_template jsonb not null default '[]'::jsonb,   -- BenefitTemplate[]
  last_verified_at  date not null default current_date,   -- critical: surfaced in UI
  status            catalog_status not null default 'active'
);

-- ---------------------------------------------------------------------------
-- User-owned instances
-- ---------------------------------------------------------------------------
create table user_cards (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users (id) on delete cascade,
  catalog_id           uuid not null references card_catalog (id),
  opened_date          date,
  annual_fee_due_date  date,
  last4                text,
  nickname             text,
  status               user_card_status not null default 'open'
);
create index user_cards_user_idx on user_cards (user_id);

create table benefits (
  id                 uuid primary key default gen_random_uuid(),
  user_card_id       uuid not null references user_cards (id) on delete cascade,
  type               benefit_type not null,
  name               text not null,
  est_value_usd      numeric not null default 0,
  expiration_date    date,
  reset_cycle        reset_cycle not null,
  used               boolean not null default false,
  used_date          date,
  notify_days_before integer[] not null default '{30,7,1}'
);
create index benefits_card_idx on benefits (user_card_id);

create table points_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users (id) on delete cascade,
  program             text not null,
  balance             numeric not null default 0,
  balance_updated_at  timestamptz not null default now(),
  expiration_policy   expiration_policy not null default 'none',
  inactivity_deadline date,
  hard_deadline       date,
  account_type        points_account_type not null default 'loyalty'
);
create index points_accounts_user_idx on points_accounts (user_id);

-- ---------------------------------------------------------------------------
-- Global program reference — powers the estimator
-- ---------------------------------------------------------------------------
create table program_reference (
  program              text primary key,
  display_name         text not null,
  cpp_low              numeric not null,
  cpp_mid              numeric not null,
  cpp_high             numeric not null,
  pricing_model        pricing_model not null,
  chart                jsonb,
  transfer_partners    jsonb,
  expiration_rule_text text not null default ''
);
