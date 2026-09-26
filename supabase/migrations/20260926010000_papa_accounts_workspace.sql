-- "18 Papa Accounts" workspace: beyond the money in/out ledger, track Papa's
-- holdings (bank accounts, stocks, mutual funds, FDs, insurance, ...), the
-- follow-up actions on them, and an inbox of photos/messages that team
-- members send in over WhatsApp.
--
-- Everything is owned by one manager (manager_id). Team members listed in
-- papa_members get the same access when they sign in with the email on
-- their member row (their login is created in Supabase Auth, like any other
-- manager account). Their WhatsApp number routes inbound messages into the
-- owner's inbox.

-- ---------------------------------------------------------------------------
-- papa_members (team: who can work on it / send WhatsApp photos)
-- ---------------------------------------------------------------------------
create table if not exists papa_members (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  whatsapp_number text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists papa_members_manager_id_idx on papa_members (manager_id);
create index if not exists papa_members_email_idx on papa_members (lower(email));

alter table papa_members enable row level security;

-- Owner, or a team member whose login email is on a member row for that owner.
create or replace function papa_has_access(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner = auth.uid()
    or exists (
      select 1 from papa_members m
      where m.manager_id = owner
        and m.email is not null
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    );
$$;

drop policy if exists "Papa team can view members" on papa_members;
create policy "Papa team can view members"
  on papa_members for select
  to authenticated
  using (papa_has_access(manager_id));

drop policy if exists "Owner can insert members" on papa_members;
create policy "Owner can insert members"
  on papa_members for insert
  to authenticated
  with check (manager_id = auth.uid());

drop policy if exists "Owner can update members" on papa_members;
create policy "Owner can update members"
  on papa_members for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

drop policy if exists "Owner can delete members" on papa_members;
create policy "Owner can delete members"
  on papa_members for delete
  to authenticated
  using (manager_id = auth.uid());

-- ---------------------------------------------------------------------------
-- papa_items (holdings)
-- ---------------------------------------------------------------------------
create table if not exists papa_items (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('bank', 'stock', 'mutual_fund', 'fixed_deposit', 'insurance', 'property', 'other')
  ),
  institution text,
  name text not null,
  -- Only the last few digits / folio suffix — never store full account numbers.
  account_ref text,
  holder text,
  nominee text,
  current_value numeric(14, 2),
  value_as_of date,
  status text not null default 'to_review' check (status in ('to_review', 'active', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists papa_items_manager_id_idx on papa_items (manager_id);

drop trigger if exists papa_items_set_updated_at on papa_items;
create trigger papa_items_set_updated_at
  before update on papa_items
  for each row
  execute function set_updated_at();

alter table papa_items enable row level security;

drop policy if exists "Papa team can manage items" on papa_items;
create policy "Papa team can manage items"
  on papa_items for all
  to authenticated
  using (papa_has_access(manager_id))
  with check (papa_has_access(manager_id));

-- ---------------------------------------------------------------------------
-- papa_documents (inbox: WhatsApp photos/messages and manual uploads)
-- ---------------------------------------------------------------------------
create table if not exists papa_documents (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references papa_items(id) on delete set null,
  storage_path text,
  body text,
  sender_name text,
  sender_number text,
  source text not null default 'whatsapp' check (source in ('whatsapp', 'upload')),
  filed boolean not null default false,
  received_at timestamptz not null default now()
);

create index if not exists papa_documents_manager_id_idx on papa_documents (manager_id, received_at desc);
create index if not exists papa_documents_item_id_idx on papa_documents (item_id);

alter table papa_documents enable row level security;

drop policy if exists "Papa team can manage documents" on papa_documents;
create policy "Papa team can manage documents"
  on papa_documents for all
  to authenticated
  using (papa_has_access(manager_id))
  with check (papa_has_access(manager_id));

-- ---------------------------------------------------------------------------
-- papa_actions (follow-ups)
-- ---------------------------------------------------------------------------
create table if not exists papa_actions (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references papa_items(id) on delete set null,
  title text not null,
  assignee text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists papa_actions_manager_id_idx on papa_actions (manager_id);
create index if not exists papa_actions_item_id_idx on papa_actions (item_id);

drop trigger if exists papa_actions_set_updated_at on papa_actions;
create trigger papa_actions_set_updated_at
  before update on papa_actions
  for each row
  execute function set_updated_at();

alter table papa_actions enable row level security;

drop policy if exists "Papa team can manage actions" on papa_actions;
create policy "Papa team can manage actions"
  on papa_actions for all
  to authenticated
  using (papa_has_access(manager_id))
  with check (papa_has_access(manager_id));

-- ---------------------------------------------------------------------------
-- Ledger: link entries to a holding, and share with the team.
-- ---------------------------------------------------------------------------
alter table papa_account_entries
  add column if not exists item_id uuid references papa_items(id) on delete set null;

drop policy if exists "Managers can view own papa entries" on papa_account_entries;
drop policy if exists "Managers can insert own papa entries" on papa_account_entries;
drop policy if exists "Managers can update own papa entries" on papa_account_entries;
drop policy if exists "Managers can delete own papa entries" on papa_account_entries;

drop policy if exists "Papa team can manage entries" on papa_account_entries;
create policy "Papa team can manage entries"
  on papa_account_entries for all
  to authenticated
  using (papa_has_access(manager_id))
  with check (papa_has_access(manager_id));

-- ---------------------------------------------------------------------------
-- The app's own WhatsApp (Twilio) number, shown in the welcome message so
-- team members know where to send photos.
-- ---------------------------------------------------------------------------
alter table manager_settings
  add column if not exists app_whatsapp_number text;

-- ---------------------------------------------------------------------------
-- Private storage bucket for statements / photos. Path: <owner id>/...
-- WhatsApp uploads happen server-side with the service role key.
-- ---------------------------------------------------------------------------
-- Safe cast: storage policies aren't guaranteed to evaluate bucket_id first.
create or replace function papa_has_access_folder(folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return papa_has_access(folder::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

insert into storage.buckets (id, name, public)
values ('papa-docs', 'papa-docs', false)
on conflict (id) do nothing;

drop policy if exists "Papa team can view docs" on storage.objects;
create policy "Papa team can view docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'papa-docs'
    and papa_has_access_folder((storage.foldername(name))[1])
  );

drop policy if exists "Papa team can upload docs" on storage.objects;
create policy "Papa team can upload docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'papa-docs'
    and papa_has_access_folder((storage.foldername(name))[1])
  );

drop policy if exists "Papa team can delete docs" on storage.objects;
create policy "Papa team can delete docs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'papa-docs'
    and papa_has_access_folder((storage.foldername(name))[1])
  );
