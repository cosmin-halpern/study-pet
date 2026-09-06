-- Study Pets — schema
--
-- Paste this into the Supabase SQL editor. Kept in git so the working
-- version survives a 1am mistake, and so a sixth species has something to
-- diff against.
--
-- Verify before trusting it:
--   select public.check_in('js');   -- once: ok
--   select public.check_in('js');   -- twice same day: already_checked_in
--   select public.sync_state();     -- three times in a row, health drops once

-- ---------- tables ----------

create table public.pet_state (
  user_id    uuid primary key references auth.users on delete cascade,
  health     int  not null default 100,
  streak     int  not null default 0,
  best       int  not null default 0,
  total      int  not null default 0,
  active     text not null default 'js',
  last_check date,
  synced_through date,   -- last day decay was charged through; see sync_state()
  tz         text not null default 'Europe/Bucharest',
  updated_at timestamptz not null default now()
);

create table public.pets (
  user_id uuid not null references auth.users on delete cascade,
  species text not null,
  days    int  not null default 0,
  shiny   boolean not null default false,
  caught_at timestamptz not null default now(),
  primary key (user_id, species)
);

create table public.checkins (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  species text not null,
  primary key (user_id, day)      -- this is what makes double check-in impossible
);

create table public.push_subs (
  user_id  uuid not null references auth.users on delete cascade,
  endpoint text primary key,
  p256dh   text not null,
  auth     text not null
);

-- Per-user display name for one of the 5 fixed creature slots — e.g. slot
-- 'js' becomes "Spanish Grammar" instead of "Advanced JS". The 5 creatures
-- themselves (art, hue, evolution names) stay fixed; only this label is
-- user data. Deliberately not a free-form subjects table with its own
-- id/count — check_in, sync_state, pets, and checkins all still operate on
-- the same 5 hardcoded species ids, untouched by this table's existence.
create table public.subjects (
  user_id    uuid not null references auth.users on delete cascade,
  species_id text not null check (species_id in ('js','fe','ai','be','alg')),
  label      text not null,
  primary key (user_id, species_id)
);

-- ---------- row level security ----------

alter table public.pet_state  enable row level security;
alter table public.pets       enable row level security;
alter table public.checkins   enable row level security;
alter table public.push_subs  enable row level security;
alter table public.subjects   enable row level security;

create policy "own state"  on public.pet_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pets"   on public.pets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own checkins" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subs"   on public.push_subs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subjects" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- functions ----------

-- today's date in the user's own timezone. The only place a "day" is ever
-- decided. Never compute this in TypeScript.
create or replace function public.user_today(p_user uuid)
returns date language sql stable as $$
  select (now() at time zone coalesce(
    (select tz from public.pet_state where user_id = p_user),
    'Europe/Bucharest'
  ))::date;
$$;

-- Decay, applied on read.
--
-- First missed day: -10 (rest days are cheap). Each further missed day: -28,
-- as a running total measured from last_check (the last real check-in).
--
-- last_check can't be the idempotency key by itself: it never moves between
-- check-ins, so a naive "subtract loss(missed)" recomputes and reapplies the
-- *same* loss on every call, not just the first one. synced_through tracks
-- how far that running total has already been charged, so each call only
-- charges the delta since last time. That also keeps the total honest
-- regardless of how many times sync_state() runs during an absence — once a
-- day or once at the end of a week produces the same final health either
-- way, because the total is always measured from last_check, never from
-- synced_through.
create or replace function public.sync_state()
returns public.pet_state
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  s public.pet_state;
  d date;
  baseline date;
  missed_now int;
  missed_before int;
  loss_now int;
  loss_before int;
  delta int;
begin
  if u is null then raise exception 'not authenticated'; end if;

  insert into public.pet_state (user_id) values (u)
    on conflict (user_id) do nothing;

  select * into s from public.pet_state where user_id = u;
  d := public.user_today(u);

  if s.last_check is null then return s; end if;

  missed_now := (d - s.last_check) - 1;
  if missed_now <= 0 then return s; end if;

  -- never charge for anything already settled, even if last_check is old
  baseline := greatest(coalesce(s.synced_through, s.last_check), s.last_check);
  if d <= baseline then return s; end if;

  missed_before := (baseline - s.last_check) - 1;

  loss_now    := case when missed_now    <= 0 then 0 else 10 + greatest(missed_now    - 1, 0) * 28 end;
  loss_before := case when missed_before <= 0 then 0 else 10 + greatest(missed_before - 1, 0) * 28 end;
  delta := loss_now - loss_before;

  update public.pet_state
     set health = greatest(0, health - delta),
         streak = 0,
         synced_through = d,
         updated_at = now()
   where user_id = u
   returning * into s;

  return s;
end $$;

-- Check in: +30 health (capped 100), one per (user, day) enforced by the
-- checkins primary key, not application logic. Catches a new species (with
-- a 1-in-12 shiny roll, permanent) or feeds the existing one. Day counts
-- never decrease, even when a pet later fades from neglect.
create or replace function public.check_in(p_species text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  d date;
  is_new boolean := false;
  is_shiny boolean := false;
  new_days int;
  s public.pet_state;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_species not in ('js','fe','ai','be','alg') then
    raise exception 'unknown species %', p_species;
  end if;

  perform public.sync_state();          -- settle any decay first
  d := public.user_today(u);

  -- the guard: fails silently if today is already logged
  insert into public.checkins (user_id, day, species)
  values (u, d, p_species)
  on conflict (user_id, day) do nothing;

  if not found then
    return json_build_object('ok', false, 'reason', 'already_checked_in');
  end if;

  -- catch or feed
  select true into is_new
  where not exists (select 1 from public.pets where user_id = u and species = p_species);

  if is_new then
    is_shiny := (random() < 1.0/12.0);
    insert into public.pets (user_id, species, days, shiny)
    values (u, p_species, 1, is_shiny);
    new_days := 1;
  else
    update public.pets set days = days + 1
     where user_id = u and species = p_species
     returning days, shiny into new_days, is_shiny;
  end if;

  update public.pet_state
     set health = least(100, health + 30),
         streak = streak + 1,
         best   = greatest(best, streak + 1),
         total  = total + 1,
         active = p_species,
         last_check = d,
         updated_at = now()
   where user_id = u
   returning * into s;

  return json_build_object(
    'ok', true, 'caught', coalesce(is_new,false),
    'shiny', is_shiny, 'days', new_days, 'state', row_to_json(s)
  );
end $$;

-- Everyone who hasn't checked in today, in their own timezone.
--
-- This used to also filter to s.tz local hour = 21, so one hourly cron
-- could correctly nag every timezone at their own 9pm. Vercel Hobby only
-- allows once-daily crons, so the cron route now fires once at a fixed UTC
-- hour instead — the per-user hour filter would just make the notification
-- fire on whatever day the cron's fixed UTC hour happens to land in each
-- user's "today," so it's dropped here rather than kept and silently wrong.
create or replace function public.users_needing_nag()
returns table (user_id uuid, health int, streak int)
language sql security definer set search_path = public as $$
  select s.user_id, s.health, s.streak
  from public.pet_state s
  where s.last_check is distinct from (now() at time zone s.tz)::date;
$$;