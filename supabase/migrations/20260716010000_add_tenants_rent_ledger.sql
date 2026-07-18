-- Tenant rent ledger: managers track tenants, their monthly rent, one-time
-- last-month-rent and security deposit amounts, and a per-month payment
-- record (received + amount). Month "columns" are computed client-side from
-- each tenant's start_month through the current month, so no scheduled job
-- is needed for new months to appear.

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_rent numeric(10, 2) not null check (monthly_rent >= 0),
  last_month_rent_received numeric(10, 2),
  security_deposit_received numeric(10, 2),
  start_month date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenants_manager_id_idx on tenants (manager_id);

drop trigger if exists tenants_set_updated_at on tenants;
create trigger tenants_set_updated_at
  before update on tenants
  for each row
  execute function set_updated_at();

alter table tenants enable row level security;

drop policy if exists "Managers can view own tenants" on tenants;
create policy "Managers can view own tenants"
  on tenants for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists "Managers can insert own tenants" on tenants;
create policy "Managers can insert own tenants"
  on tenants for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Managers can update own tenants" on tenants;
create policy "Managers can update own tenants"
  on tenants for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

drop policy if exists "Managers can delete own tenants" on tenants;
create policy "Managers can delete own tenants"
  on tenants for delete
  to authenticated
  using (manager_id = auth.uid());

-- ---------------------------------------------------------------------------
-- tenant_rent_payments (one row per tenant per month)
-- ---------------------------------------------------------------------------
create table if not exists tenant_rent_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  month date not null,
  received boolean not null default false,
  amount_received numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, month)
);

create index if not exists tenant_rent_payments_tenant_id_idx on tenant_rent_payments (tenant_id);

drop trigger if exists tenant_rent_payments_set_updated_at on tenant_rent_payments;
create trigger tenant_rent_payments_set_updated_at
  before update on tenant_rent_payments
  for each row
  execute function set_updated_at();

alter table tenant_rent_payments enable row level security;

drop policy if exists "Managers can view own tenant payments" on tenant_rent_payments;
create policy "Managers can view own tenant payments"
  on tenant_rent_payments for select
  to authenticated
  using (
    exists (
      select 1 from tenants
      where tenants.id = tenant_rent_payments.tenant_id
        and tenants.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can insert own tenant payments" on tenant_rent_payments;
create policy "Managers can insert own tenant payments"
  on tenant_rent_payments for insert
  to authenticated
  with check (
    exists (
      select 1 from tenants
      where tenants.id = tenant_rent_payments.tenant_id
        and tenants.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can update own tenant payments" on tenant_rent_payments;
create policy "Managers can update own tenant payments"
  on tenant_rent_payments for update
  to authenticated
  using (
    exists (
      select 1 from tenants
      where tenants.id = tenant_rent_payments.tenant_id
        and tenants.manager_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tenants
      where tenants.id = tenant_rent_payments.tenant_id
        and tenants.manager_id = auth.uid()
    )
  );

drop policy if exists "Managers can delete own tenant payments" on tenant_rent_payments;
create policy "Managers can delete own tenant payments"
  on tenant_rent_payments for delete
  to authenticated
  using (
    exists (
      select 1 from tenants
      where tenants.id = tenant_rent_payments.tenant_id
        and tenants.manager_id = auth.uid()
    )
  );
