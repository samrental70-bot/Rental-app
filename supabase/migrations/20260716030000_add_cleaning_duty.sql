-- Cleaning-duty rotation: each property has a cycle length (days between
-- tenants' turns) and a rotation order of tenants. Only one active
-- (uncompleted) turn exists per location at a time; the rotation does not
-- advance to the next tenant until the manager approves the current turn.

alter table locations
  add column if not exists cleaning_cycle_days integer check (cleaning_cycle_days > 0),
  add column if not exists cleaning_start_date date;

alter table tenants
  add column if not exists whatsapp_number text,
  add column if not exists cleaning_order integer;

-- ---------------------------------------------------------------------------
-- cleaning_turns
-- ---------------------------------------------------------------------------
create table if not exists cleaning_turns (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  start_date date not null,
  due_date date not null,
  advance_reminder_sent_at timestamptz,
  reminder1_sent_at timestamptz,
  reminder2_sent_at timestamptz,
  manager_alert_sent_at timestamptz,
  proof_submitted_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cleaning_turns_location_id_idx on cleaning_turns (location_id);
create index if not exists cleaning_turns_tenant_id_idx on cleaning_turns (tenant_id);

-- Only one active (not-yet-completed) turn per location at a time.
create unique index if not exists cleaning_turns_one_active_per_location
  on cleaning_turns (location_id)
  where not completed;

alter table cleaning_turns enable row level security;

drop policy if exists "Managers can view own cleaning turns" on cleaning_turns;
create policy "Managers can view own cleaning turns"
  on cleaning_turns for select
  to authenticated
  using (
    exists (
      select 1 from locations
      where locations.id = cleaning_turns.location_id
        and locations.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can insert own cleaning turns" on cleaning_turns;
create policy "Managers can insert own cleaning turns"
  on cleaning_turns for insert
  to authenticated
  with check (
    exists (
      select 1 from locations
      where locations.id = cleaning_turns.location_id
        and locations.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can update own cleaning turns" on cleaning_turns;
create policy "Managers can update own cleaning turns"
  on cleaning_turns for update
  to authenticated
  using (
    exists (
      select 1 from locations
      where locations.id = cleaning_turns.location_id
        and locations.manager_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from locations
      where locations.id = cleaning_turns.location_id
        and locations.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can delete own cleaning turns" on cleaning_turns;
create policy "Managers can delete own cleaning turns"
  on cleaning_turns for delete
  to authenticated
  using (
    exists (
      select 1 from locations
      where locations.id = cleaning_turns.location_id
        and locations.manager_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- cleaning_turn_photos (uploaded server-side via the WhatsApp inbound
-- webhook using the service role key, so only a SELECT policy is needed)
-- ---------------------------------------------------------------------------
create table if not exists cleaning_turn_photos (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references cleaning_turns(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists cleaning_turn_photos_turn_id_idx on cleaning_turn_photos (turn_id);

alter table cleaning_turn_photos enable row level security;

drop policy if exists "Managers can view own cleaning turn photos" on cleaning_turn_photos;
create policy "Managers can view own cleaning turn photos"
  on cleaning_turn_photos for select
  to authenticated
  using (
    exists (
      select 1 from cleaning_turns
      join locations on locations.id = cleaning_turns.location_id
      where cleaning_turns.id = cleaning_turn_photos.turn_id
        and locations.manager_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Private storage bucket for cleaning proof photos (not public — tenants'
-- living spaces). Only the owning manager can read; uploads happen
-- server-side via the service role key, which bypasses RLS.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cleaning-photos', 'cleaning-photos', false)
on conflict (id) do nothing;

drop policy if exists "Managers can view their own cleaning photos" on storage.objects;
create policy "Managers can view their own cleaning photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cleaning-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
