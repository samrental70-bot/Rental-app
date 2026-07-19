-- Manager's own WhatsApp number, used for the "tenant hasn't responded"
-- cleaning-duty alert.
create table if not exists manager_settings (
  manager_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text,
  updated_at timestamptz not null default now()
);

drop trigger if exists manager_settings_set_updated_at on manager_settings;
create trigger manager_settings_set_updated_at
  before update on manager_settings
  for each row
  execute function set_updated_at();

alter table manager_settings enable row level security;

drop policy if exists "Managers can view own settings" on manager_settings;
create policy "Managers can view own settings"
  on manager_settings for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "Managers can insert own settings" on manager_settings;
create policy "Managers can insert own settings"
  on manager_settings for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Managers can update own settings" on manager_settings;
create policy "Managers can update own settings"
  on manager_settings for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());
