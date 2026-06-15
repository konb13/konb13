-- "Add card from catalog" auto-populates that card's benefits with default
-- expirations (build plan Phase 1). Done server-side via a trigger so both the
-- app and the future web frontend get identical behaviour.

create or replace function materialize_card_benefits()
returns trigger
language plpgsql
as $$
declare
  tmpl jsonb;
  cycle text;
  exp_date date;
begin
  for tmpl in
    select jsonb_array_elements(benefits_template)
    from card_catalog where id = new.catalog_id
  loop
    cycle := tmpl->>'reset_cycle';
    exp_date := case cycle
      when 'calendar_year'   then make_date(extract(year from current_date)::int, 12, 31)
      when 'cardmember_year' then coalesce(new.opened_date, current_date) + interval '1 year'
      when 'annual'          then current_date + interval '1 year'
      else null
    end;

    insert into benefits (user_card_id, type, name, est_value_usd, expiration_date, reset_cycle, notify_days_before)
    values (
      new.id,
      (tmpl->>'type')::benefit_type,
      tmpl->>'name',
      coalesce((tmpl->>'est_value_usd')::numeric, 0),
      exp_date,
      cycle::reset_cycle,
      coalesce(
        (select array_agg((v)::int) from jsonb_array_elements_text(tmpl->'notify_days_before') v),
        '{30,7,1}'::int[]
      )
    );
  end loop;
  return new;
end;
$$;

create trigger trg_materialize_card_benefits
  after insert on user_cards
  for each row execute function materialize_card_benefits();
