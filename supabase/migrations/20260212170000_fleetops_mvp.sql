create extension if not exists pgcrypto;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('marine', 'vehicle', 'equipment', 'other')),
  identifier text,
  current_usage numeric not null default 0,
  usage_unit text not null check (usage_unit in ('hours', 'miles', 'runtime', 'cycles')),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date timestamptz not null default now(),
  value numeric not null,
  unit text not null,
  notes text
);

create table if not exists public.maintenance_entries (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date timestamptz not null default now(),
  category text not null,
  cost numeric,
  notes text,
  attachment_url text
);

create table if not exists public.downtime_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_date timestamptz not null,
  end_date timestamptz,
  reason text not null,
  notes text
);

create table if not exists public.maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trigger_unit text not null check (trigger_unit in ('hours', 'miles', 'runtime', 'cycles', 'days')),
  interval_value numeric not null,
  last_completed_value numeric,
  last_completed_date timestamptz
);

create index if not exists idx_assets_owner_id on public.assets (owner_id);
create index if not exists idx_usage_logs_asset_id on public.usage_logs (asset_id);
create index if not exists idx_usage_logs_owner_id on public.usage_logs (owner_id);
create index if not exists idx_maintenance_entries_asset_id on public.maintenance_entries (asset_id);
create index if not exists idx_maintenance_entries_owner_id on public.maintenance_entries (owner_id);
create index if not exists idx_downtime_events_asset_id on public.downtime_events (asset_id);
create index if not exists idx_downtime_events_owner_id on public.downtime_events (owner_id);
create index if not exists idx_maintenance_rules_asset_id on public.maintenance_rules (asset_id);
create index if not exists idx_maintenance_rules_owner_id on public.maintenance_rules (owner_id);

alter table public.assets enable row level security;
alter table public.usage_logs enable row level security;
alter table public.maintenance_entries enable row level security;
alter table public.downtime_events enable row level security;
alter table public.maintenance_rules enable row level security;

drop policy if exists assets_select_own on public.assets;
create policy assets_select_own on public.assets for select using (owner_id = auth.uid());
drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own on public.assets for insert with check (owner_id = auth.uid());
drop policy if exists assets_update_own on public.assets;
create policy assets_update_own on public.assets for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists assets_delete_own on public.assets;
create policy assets_delete_own on public.assets for delete using (owner_id = auth.uid());

drop policy if exists usage_logs_select_own on public.usage_logs;
create policy usage_logs_select_own on public.usage_logs for select using (owner_id = auth.uid());
drop policy if exists usage_logs_insert_own on public.usage_logs;
create policy usage_logs_insert_own on public.usage_logs for insert with check (owner_id = auth.uid());
drop policy if exists usage_logs_update_own on public.usage_logs;
create policy usage_logs_update_own on public.usage_logs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists usage_logs_delete_own on public.usage_logs;
create policy usage_logs_delete_own on public.usage_logs for delete using (owner_id = auth.uid());

drop policy if exists maintenance_entries_select_own on public.maintenance_entries;
create policy maintenance_entries_select_own on public.maintenance_entries for select using (owner_id = auth.uid());
drop policy if exists maintenance_entries_insert_own on public.maintenance_entries;
create policy maintenance_entries_insert_own on public.maintenance_entries for insert with check (owner_id = auth.uid());
drop policy if exists maintenance_entries_update_own on public.maintenance_entries;
create policy maintenance_entries_update_own on public.maintenance_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists maintenance_entries_delete_own on public.maintenance_entries;
create policy maintenance_entries_delete_own on public.maintenance_entries for delete using (owner_id = auth.uid());

drop policy if exists downtime_events_select_own on public.downtime_events;
create policy downtime_events_select_own on public.downtime_events for select using (owner_id = auth.uid());
drop policy if exists downtime_events_insert_own on public.downtime_events;
create policy downtime_events_insert_own on public.downtime_events for insert with check (owner_id = auth.uid());
drop policy if exists downtime_events_update_own on public.downtime_events;
create policy downtime_events_update_own on public.downtime_events for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists downtime_events_delete_own on public.downtime_events;
create policy downtime_events_delete_own on public.downtime_events for delete using (owner_id = auth.uid());

drop policy if exists maintenance_rules_select_own on public.maintenance_rules;
create policy maintenance_rules_select_own on public.maintenance_rules for select using (owner_id = auth.uid());
drop policy if exists maintenance_rules_insert_own on public.maintenance_rules;
create policy maintenance_rules_insert_own on public.maintenance_rules for insert with check (owner_id = auth.uid());
drop policy if exists maintenance_rules_update_own on public.maintenance_rules;
create policy maintenance_rules_update_own on public.maintenance_rules for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists maintenance_rules_delete_own on public.maintenance_rules;
create policy maintenance_rules_delete_own on public.maintenance_rules for delete using (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('maintenance-attachments', 'maintenance-attachments', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists maintenance_attachments_select on storage.objects;
create policy maintenance_attachments_select
on storage.objects
for select
using (bucket_id = 'maintenance-attachments' and owner = auth.uid());

drop policy if exists maintenance_attachments_insert on storage.objects;
create policy maintenance_attachments_insert
on storage.objects
for insert
with check (bucket_id = 'maintenance-attachments' and owner = auth.uid());

drop policy if exists maintenance_attachments_update on storage.objects;
create policy maintenance_attachments_update
on storage.objects
for update
using (bucket_id = 'maintenance-attachments' and owner = auth.uid())
with check (bucket_id = 'maintenance-attachments' and owner = auth.uid());

drop policy if exists maintenance_attachments_delete on storage.objects;
create policy maintenance_attachments_delete
on storage.objects
for delete
using (bucket_id = 'maintenance-attachments' and owner = auth.uid());
