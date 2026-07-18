-- Group tenants by rental property (location) and unit level within it.
alter table tenants
  add column if not exists location_id uuid references locations(id) on delete set null,
  add column if not exists unit_level text check (unit_level in ('basement', 'main_floor', 'upper_floor'));

create index if not exists tenants_location_id_idx on tenants (location_id);
