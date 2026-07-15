-- Rental App schema: rooms, room photos, and visit (viewing) requests.
-- Rooms are only visible to the public when status = 'empty'.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  address text,
  rent_amount numeric(10, 2) not null check (rent_amount >= 0),
  rent_period text not null default 'month' check (rent_period in ('week', 'month')),
  gender_preference text not null default 'any' check (gender_preference in ('any', 'male', 'female')),
  available_from date not null default current_date,
  status text not null default 'occupied' check (status in ('empty', 'occupied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_manager_id_idx on rooms (manager_id);
create index if not exists rooms_status_idx on rooms (status);

-- ---------------------------------------------------------------------------
-- room_photos
-- ---------------------------------------------------------------------------
create table if not exists room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists room_photos_room_id_idx on room_photos (room_id);

-- ---------------------------------------------------------------------------
-- visit_requests (public "schedule a visit" submissions)
-- ---------------------------------------------------------------------------
create table if not exists visit_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  visa_status text not null check (
    visa_status in ('citizen', 'permanent_resident', 'study_permit', 'work_permit', 'visitor', 'other')
  ),
  applicant_gender text not null check (applicant_gender in ('male', 'female', 'other')),
  room_required_from date not null,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists visit_requests_room_id_idx on visit_requests (room_id);
create index if not exists visit_requests_status_idx on visit_requests (status);

-- ---------------------------------------------------------------------------
-- updated_at trigger for rooms
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on rooms;
create trigger rooms_set_updated_at
  before update on rooms
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table rooms enable row level security;
alter table room_photos enable row level security;
alter table visit_requests enable row level security;

-- rooms: public can only ever see rooms marked empty
drop policy if exists "Public can view empty rooms" on rooms;
create policy "Public can view empty rooms"
  on rooms for select
  to anon, authenticated
  using (status = 'empty');

-- rooms: managers have full visibility + control over their own rooms
drop policy if exists "Managers can view own rooms" on rooms;
create policy "Managers can view own rooms"
  on rooms for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "Managers can insert own rooms" on rooms;
create policy "Managers can insert own rooms"
  on rooms for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Managers can update own rooms" on rooms;
create policy "Managers can update own rooms"
  on rooms for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

drop policy if exists "Managers can delete own rooms" on rooms;
create policy "Managers can delete own rooms"
  on rooms for delete
  to authenticated
  using (manager_id = auth.uid());

-- room_photos: public can view photos belonging to visible (empty) rooms
drop policy if exists "Public can view photos of empty rooms" on room_photos;
create policy "Public can view photos of empty rooms"
  on room_photos for select
  to anon, authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = room_photos.room_id
        and rooms.status = 'empty'
    )
  );

-- room_photos: managers manage photos on their own rooms
drop policy if exists "Managers can view own room photos" on room_photos;
create policy "Managers can view own room photos"
  on room_photos for select
  to authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = room_photos.room_id
        and rooms.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can insert own room photos" on room_photos;
create policy "Managers can insert own room photos"
  on room_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from rooms
      where rooms.id = room_photos.room_id
        and rooms.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can delete own room photos" on room_photos;
create policy "Managers can delete own room photos"
  on room_photos for delete
  to authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = room_photos.room_id
        and rooms.manager_id = auth.uid()
    )
  );

-- visit_requests: anyone (including anonymous visitors) can submit a request
-- for a room that is currently visible to the public. No public read access.
drop policy if exists "Public can submit visit requests for empty rooms" on visit_requests;
create policy "Public can submit visit requests for empty rooms"
  on visit_requests for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from rooms
      where rooms.id = visit_requests.room_id
        and rooms.status = 'empty'
    )
  );

-- visit_requests: managers can view/update requests for their own rooms
drop policy if exists "Managers can view own room visit requests" on visit_requests;
create policy "Managers can view own room visit requests"
  on visit_requests for select
  to authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = visit_requests.room_id
        and rooms.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can update own room visit requests" on visit_requests;
create policy "Managers can update own room visit requests"
  on visit_requests for update
  to authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = visit_requests.room_id
        and rooms.manager_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rooms
      where rooms.id = visit_requests.room_id
        and rooms.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can delete own room visit requests" on visit_requests;
create policy "Managers can delete own room visit requests"
  on visit_requests for delete
  to authenticated
  using (
    exists (
      select 1 from rooms
      where rooms.id = visit_requests.room_id
        and rooms.manager_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for room photos (public read, manager-only write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public can view room photos" on storage.objects;
create policy "Public can view room photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'room-photos');

-- Managers upload/delete only within a folder named after their own user id,
-- e.g. room-photos/<manager_id>/<room_id>/<filename>.
drop policy if exists "Managers can upload their own room photos" on storage.objects;
create policy "Managers can upload their own room photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'room-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Managers can delete their own room photos" on storage.objects;
create policy "Managers can delete their own room photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'room-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
