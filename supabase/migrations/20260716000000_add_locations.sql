-- Group rooms under locations. Managers create a location first, then add
-- rooms inside it. Public visitors browse by location.

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_manager_id_idx on locations (manager_id);

drop trigger if exists locations_set_updated_at on locations;
create trigger locations_set_updated_at
  before update on locations
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- rooms.location_id (added before locations RLS below, which references it)
-- ---------------------------------------------------------------------------
alter table rooms
  add column if not exists location_id uuid references locations(id) on delete cascade;

create index if not exists rooms_location_id_idx on rooms (location_id);

alter table locations enable row level security;

drop policy if exists "Public can view locations with empty rooms" on locations;
create policy "Public can view locations with empty rooms"
  on locations for select
  to anon, authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.location_id = locations.id
        and rooms.status = 'empty'
    )
  );

drop policy if exists "Managers can view own locations" on locations;
create policy "Managers can view own locations"
  on locations for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "Managers can insert own locations" on locations;
create policy "Managers can insert own locations"
  on locations for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Managers can update own locations" on locations;
create policy "Managers can update own locations"
  on locations for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

drop policy if exists "Managers can delete own locations" on locations;
create policy "Managers can delete own locations"
  on locations for delete
  to authenticated
  using (manager_id = auth.uid());
