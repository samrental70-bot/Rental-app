-- "18 Papa Accounts": a simple money-in / money-out ledger the manager keeps
-- for Papa's accounts. Each row is one transaction; totals and the running
-- balance are computed client-side.

create table if not exists papa_account_entries (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  description text not null,
  category text,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(12, 2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists papa_account_entries_manager_id_idx
  on papa_account_entries (manager_id, entry_date);

drop trigger if exists papa_account_entries_set_updated_at on papa_account_entries;
create trigger papa_account_entries_set_updated_at
  before update on papa_account_entries
  for each row
  execute function set_updated_at();

alter table papa_account_entries enable row level security;

drop policy if exists "Managers can view own papa entries" on papa_account_entries;
create policy "Managers can view own papa entries"
  on papa_account_entries for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "Managers can insert own papa entries" on papa_account_entries;
create policy "Managers can insert own papa entries"
  on papa_account_entries for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Managers can update own papa entries" on papa_account_entries;
create policy "Managers can update own papa entries"
  on papa_account_entries for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

drop policy if exists "Managers can delete own papa entries" on papa_account_entries;
create policy "Managers can delete own papa entries"
  on papa_account_entries for delete
  to authenticated
  using (manager_id = auth.uid());
