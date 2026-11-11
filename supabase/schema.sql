-- ============================================================
--  Donation Box ERP - Supabase schema
--  Supabase Dashboard -> SQL Editor -> paste -> Run
--  (safe: sirf naye tables/functions banata hai, data nahi chhedta)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- USERS (profile + role + scope). Auth account Supabase Auth me.
-- password kabhi yahan save nahi hota.
-- ------------------------------------------------------------
create table if not exists public.users (
  id           text primary key,
  "employeeCode" text unique,
  "fullName"   text,
  email        text,
  "authEmail"  text,
  mobile       text,
  photo        text,
  role         text default '',
  department   text,
  designation  text,
  region       text default '',
  state        text default '',
  division     text default '',
  hub          text default '',
  warehouse    text default '',
  status       text default 'Active',
  "createdAt"  text,
  "createdBy"  text,
  "updatedAt"  text,
  "updatedBy"  text
);

-- ------------------------------------------------------------
-- STOCK LEDGER (IN + OUT)
-- ------------------------------------------------------------
create table if not exists public.stock_ledger (
  id           text primary key default gen_random_uuid()::text,
  date         text,
  "itemName"   text,
  quantity     integer,
  unit         text,
  region       text default '',
  state        text default '',
  division     text default '',
  hub          text default '',
  recipient    text,
  "empCode"    text,
  purpose      text,
  source       text,
  notes        text,
  type         text default 'OUT',
  "createdBy"  text,
  role         text,
  "demandId"   text,
  "createdAt"  text,
  "updatedAt"  text,
  "updatedBy"  text
);
create index if not exists stock_ledger_scope_idx on public.stock_ledger (region, state, division, hub);
create index if not exists stock_ledger_type_idx  on public.stock_ledger (type);

-- ------------------------------------------------------------
-- DEMANDS (photo bhi yahin attachmentData me base64)
-- ------------------------------------------------------------
create table if not exists public.demands (
  id                text primary key default gen_random_uuid()::text,
  date              text,
  status            text default 'Pending',
  priority          text,
  "requestingEntity" text,
  notes             text,
  region            text default '',
  state             text default '',
  division          text default '',
  hub               text default '',
  items             jsonb,
  "attachmentData"  text,
  "attachmentUrl"   text,
  "dispatchLog"     jsonb,
  "receiveLog"      jsonb,
  "approvedAt"      text,
  "approvedBy"      text,
  "rejectedAt"      text,
  "rejectedBy"      text,
  "rejectionReason" text,
  "dispatchedAt"    text,
  "dispatchedBy"    text,
  "receivedAt"      text,
  "receivedBy"      text,
  "receivedByRole"  text,
  "createdBy"       text,
  role              text,
  "createdAt"       text,
  "updatedAt"       text
);
create index if not exists demands_scope_idx on public.demands (region, state, division, hub);
create index if not exists demands_status_idx on public.demands (status);

-- ------------------------------------------------------------
-- MASTER DATA
-- ------------------------------------------------------------
create table if not exists public.regions (
  id text primary key default gen_random_uuid()::text,
  name text, "createdAt" text
);
create table if not exists public.states (
  id text primary key default gen_random_uuid()::text,
  name text, "regionId" text, "regionName" text, region text, "createdAt" text
);
create table if not exists public.divisions (
  id text primary key default gen_random_uuid()::text,
  name text, "regionId" text, "stateId" text, "regionName" text, "stateName" text, "createdAt" text
);
create table if not exists public.hubs (
  id text primary key default gen_random_uuid()::text,
  name text, code text, region text, state text, division text,
  address text, incharge text, phone text, capacity integer,
  status text default 'Active', "createdAt" text
);
create table if not exists public.items (
  id text primary key default gen_random_uuid()::text,
  name text, unit text, "createdAt" text, "updatedAt" text
);

-- ============================================================
-- SCOPE HELPERS (custom claims ki jagah users table se padhte hain)
-- SECURITY DEFINER => RLS ko bypass karke profile padh sakte hain
-- ============================================================
create or replace function public.app_field(k text)
returns text
language sql security definer set search_path = public as $$
  select case k
    when 'role'     then coalesce(role,'')
    when 'region'   then case when upper(coalesce(region,''))   = 'ALL' then '' else coalesce(region,'') end
    when 'state'    then case when upper(coalesce(state,''))    = 'ALL' then '' else coalesce(state,'') end
    when 'division' then case when upper(coalesce(division,'')) = 'ALL' then '' else coalesce(division,'') end
    when 'hub'      then case
                           when upper(coalesce(hub,''))       = 'ALL' then ''
                           when coalesce(hub,'') <> '' then hub
                           when upper(coalesce(warehouse,'')) = 'ALL' then ''
                           else coalesce(warehouse,'')
                         end
    when 'status'   then coalesce(status,'')
    else ''
  end
  from public.users where id = auth.uid()::text;
$$;

create or replace function public.app_is_admin() returns boolean
language sql security definer set search_path = public as $$
  select public.app_field('role') in ('Super Admin','Admin');
$$;

-- Login ke waqt Employee Code -> Auth email.
-- authEmail = jis email se login account bana (original email ya internal).
-- Sirf ye ek email return karta hai, baaki koi data nahi.
create or replace function public.app_login_email(p_code text)
returns text
language sql security definer set search_path = public as $$
  select coalesce(
    nullif("authEmail", ''),
    case when coalesce(email,'') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' then lower(email) else null end,
    lower("employeeCode") || '@donationbox.app'
  )
  from public.users
  where lower("employeeCode") = lower(trim(p_code))
  limit 1;
$$;
revoke all on function public.app_login_email(text) from public;
grant execute on function public.app_login_email(text) to anon, authenticated;

create or replace function public.app_can_write() returns boolean
language sql security definer set search_path = public as $$
  select public.app_field('status') = 'Active'
     and public.app_field('role') <> ''
     and public.app_field('role') <> 'User';
$$;

create or replace function public.app_can_delete() returns boolean
language sql security definer set search_path = public as $$
  select public.app_field('role') in ('Super Admin','Admin','Regional Office','State Office');
$$;

-- hub > division > state > region  (Admin sab kuch)
create or replace function public.app_in_scope(r text, s text, d text, h text)
returns boolean
language sql security definer set search_path = public as $$
  select case
    when public.app_field('role') in ('Super Admin','Admin') then true
    when public.app_field('role') = 'User' then false
    when public.app_field('hub')      <> '' then coalesce(h,'') = public.app_field('hub')
    when public.app_field('division') <> '' then coalesce(d,'') = public.app_field('division')
    when public.app_field('state')    <> '' then coalesce(s,'') = public.app_field('state')
    when public.app_field('region')   <> '' then coalesce(r,'') = public.app_field('region')
    else false
  end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users        enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.demands      enable row level security;
alter table public.regions      enable row level security;
alter table public.states       enable row level security;
alter table public.divisions    enable row level security;
alter table public.hubs         enable row level security;
alter table public.items        enable row level security;

-- ---- users ----
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = auth.uid()::text or public.app_is_admin());

drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- ---- stock_ledger ----
drop policy if exists sl_select on public.stock_ledger;
create policy sl_select on public.stock_ledger for select to authenticated
  using (public.app_in_scope(region, state, division, hub));

drop policy if exists sl_insert on public.stock_ledger;
create policy sl_insert on public.stock_ledger for insert to authenticated
  with check (public.app_can_write() and public.app_in_scope(region, state, division, hub));

drop policy if exists sl_update on public.stock_ledger;
create policy sl_update on public.stock_ledger for update to authenticated
  using (public.app_can_write() and public.app_in_scope(region, state, division, hub))
  with check (public.app_can_write() and public.app_in_scope(region, state, division, hub));

drop policy if exists sl_delete on public.stock_ledger;
create policy sl_delete on public.stock_ledger for delete to authenticated
  using (public.app_can_delete() and public.app_in_scope(region, state, division, hub));

-- ---- demands ----
drop policy if exists dm_select on public.demands;
create policy dm_select on public.demands for select to authenticated
  using (public.app_in_scope(region, state, division, hub));

drop policy if exists dm_insert on public.demands;
create policy dm_insert on public.demands for insert to authenticated
  with check (public.app_can_write() and public.app_in_scope(region, state, division, hub));

drop policy if exists dm_update on public.demands;
create policy dm_update on public.demands for update to authenticated
  using (public.app_can_write() and public.app_in_scope(region, state, division, hub))
  with check (public.app_can_write() and public.app_in_scope(region, state, division, hub));

drop policy if exists dm_delete on public.demands;
create policy dm_delete on public.demands for delete to authenticated
  using (public.app_can_delete() and public.app_in_scope(region, state, division, hub));

-- ---- master data: sab signed-in padh sakte, sirf admin likh sakta ----
do $$
declare t text;
begin
  foreach t in array array['regions','states','divisions','hubs','items'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin())', t, t);
  end loop;
end $$;

-- ============================================================
-- NOTE: sabse pehla Admin user migration script banata hai
-- (service_role key se Auth account + users row).
-- ============================================================
