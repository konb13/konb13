-- Onboarding: a brand-new authenticated user has no household yet, so RLS would
-- show them an empty app. These security-definer RPCs bootstrap the first
-- household (owner) or join an existing one by invite code — the only writes a
-- user without a household row is allowed to make.

alter table households
  add column invite_code text unique default upper(substr(md5(random()::text), 1, 6));

-- Create a household and make the caller its owner.
create or replace function create_household(p_name text, p_display_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  if exists (select 1 from users where id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  insert into households (name)
    values (coalesce(nullif(trim(p_name), ''), 'My Household'))
    returning * into h;
  insert into users (id, household_id, display_name, email, role)
    values (auth.uid(), h.id, coalesce(nullif(trim(p_display_name), ''), 'Me'),
            coalesce(auth.jwt() ->> 'email', ''), 'owner');
  return h;
end;
$$;

-- Join an existing household by its invite code.
create or replace function join_household(p_code text, p_display_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into users (id, household_id, display_name, email, role)
    values (auth.uid(), h.id, coalesce(nullif(trim(p_display_name), ''), 'Me'),
            coalesce(auth.jwt() ->> 'email', ''), 'member')
    on conflict (id) do nothing;
  return h;
end;
$$;

grant execute on function create_household(text, text) to authenticated;
grant execute on function join_household(text, text) to authenticated;
