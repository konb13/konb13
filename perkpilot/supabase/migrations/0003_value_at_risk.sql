-- The flagship derived view (build plan §3): "a query, not a table". Every
-- unused benefit expiring within 90 days + every points account within 120
-- days of an expiration deadline. RLS on the underlying tables means this view
-- is automatically scoped per household.

create or replace view value_at_risk as
  select
    'benefit'::text                         as kind,
    b.id                                    as id,
    uc.user_id                              as user_id,
    b.name                                  as title,
    (cc.issuer || ' ' || cc.product_name)   as subtitle,
    b.est_value_usd                         as est_value_usd,
    b.expiration_date                       as deadline,
    (b.expiration_date - current_date)      as days_left,
    case
      when b.expiration_date - current_date <= 7  then 'red'
      when b.expiration_date - current_date <= 30 then 'amber'
      else 'green'
    end                                     as urgency
  from benefits b
  join user_cards uc   on uc.id = b.user_card_id
  join card_catalog cc on cc.id = uc.catalog_id
  where b.used = false
    and b.expiration_date is not null
    and b.expiration_date >= current_date
    and b.expiration_date <= current_date + 90

  union all

  select
    'points'::text                          as kind,
    p.id                                    as id,
    p.user_id                               as user_id,
    (to_char(p.balance, 'FM999,999,999') || ' ' || coalesce(pr.display_name, p.program) || ' points') as title,
    case when p.account_type = 'vacation_club'
         then 'Vacation club — hard lapse'
         else 'Expiring from inactivity' end as subtitle,
    0::numeric                              as est_value_usd,
    coalesce(p.hard_deadline, p.inactivity_deadline) as deadline,
    (coalesce(p.hard_deadline, p.inactivity_deadline) - current_date) as days_left,
    case
      when coalesce(p.hard_deadline, p.inactivity_deadline) - current_date <= 30  then 'red'
      when coalesce(p.hard_deadline, p.inactivity_deadline) - current_date <= 120 then 'amber'
      else 'green'
    end                                     as urgency
  from points_accounts p
  left join program_reference pr on pr.program = p.program
  where coalesce(p.hard_deadline, p.inactivity_deadline) is not null
    and coalesce(p.hard_deadline, p.inactivity_deadline) >= current_date
    and coalesce(p.hard_deadline, p.inactivity_deadline) <= current_date + 120

  order by days_left;
