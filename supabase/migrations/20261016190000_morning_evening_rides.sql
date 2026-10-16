-- Morning and evening rides: an owner's usual rides go both ways, home to office in the
-- morning and office to home in the evening, each with its own pickup stops, time, seats and
-- price. Until now the app kept one usual ride per owner; existing ones are morning rides.
-- Each direction is saved at most once per owner; going live works per usual ride as before.

alter table public.usual_rides
  add column direction text not null default 'MORNING'
    check (direction in ('MORNING', 'EVENING'));

create unique index usual_rides_one_per_direction_idx
  on public.usual_rides (owner_id, direction);
