create extension if not exists citext;

-- ============ 3.1 hierarchy ============
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('direct','agency')),
  billing_email text not null,
  stripe_customer_id text,
  is_reseller boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  legal_name text not null,
  ein text,
  entity_type text,
  country text not null default 'US',
  created_at timestamptz not null default now(),
  unique (account_id, ein)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  name text not null,
  slug text not null,
  timezone text not null default 'America/New_York',
  industry text,
  created_at timestamptz not null default now(),
  unique (account_id, slug)
);
create index on public.workspaces (legal_entity_id);
create index on public.legal_entities (account_id);

-- ============ 3.2 users ============
create table public.users (
  id uuid primary key,
  email citext not null unique,
  full_name text,
  avatar_url text,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('owner','admin')),
  created_at timestamptz not null default now(),
  unique (user_id, account_id)
);

-- ============ helpers ============
create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.is_staff from public.users u where u.id = _uid), false)
$$;

create or replace function public.has_account_access(_acct uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid())
      or exists (select 1 from public.account_memberships am
                 where am.account_id = _acct and am.user_id = auth.uid())
      or exists (select 1 from public.memberships m
                 join public.workspaces w on w.id = m.workspace_id
                 where w.account_id = _acct and m.user_id = auth.uid())
$$;

create or replace function public.has_workspace_access(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid())
      or exists (select 1 from public.memberships m
                 where m.workspace_id = _ws and m.user_id = auth.uid())
      or exists (select 1 from public.workspaces w
                 join public.account_memberships am on am.account_id = w.account_id
                 where w.id = _ws and am.user_id = auth.uid())
$$;

create or replace function public.can_manage_workspace(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid())
      or exists (select 1 from public.memberships m
                 where m.workspace_id = _ws and m.user_id = auth.uid()
                   and m.role in ('owner','admin'))
      or exists (select 1 from public.workspaces w
                 join public.account_memberships am on am.account_id = w.account_id
                 where w.id = _ws and am.user_id = auth.uid())
$$;

create or replace function public.has_entity_access(_le uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid())
      or exists (select 1 from public.legal_entities le
                 join public.account_memberships am on am.account_id = le.account_id
                 where le.id = _le and am.user_id = auth.uid())
      or exists (select 1 from public.workspaces w
                 join public.memberships m on m.workspace_id = w.id
                 where w.legal_entity_id = _le and m.user_id = auth.uid())
$$;

-- ============ 3.3 apps ============
create table public.apps (
  id text primary key,
  name text not null,
  description text,
  icon text,
  base_url text not null,
  manifest jsonb not null default '{}',
  is_alacarte boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_packs (
  id text primary key,
  name text not null,
  description text,
  app_ids text[] not null,
  created_at timestamptz not null default now()
);

create table public.app_credentials (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references public.apps(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.app_credentials (token_prefix);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  app_id text not null references public.apps(id),
  plan text not null default 'standard',
  status text not null check (status in ('active','trialing','past_due','canceled')),
  seats int not null default 1,
  settings jsonb not null default '{}',
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (workspace_id, app_id)
);
create index on public.entitlements (workspace_id, status);

-- ============ 3.4 contacts ============
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  first_name text,
  last_name text,
  company text,
  mailing_address jsonb,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts (legal_entity_id);

create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  e164 text not null,
  is_primary boolean not null default false,
  line_type text,
  carrier text,
  connection_status text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (legal_entity_id, e164, contact_id)
);
create index on public.contact_phones (legal_entity_id, e164);

create table public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  email citext not null,
  is_primary boolean not null default false,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (legal_entity_id, email, contact_id)
);

-- ============ 3.5 consent / suppression ============
create table public.suppressions (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  channel text not null check (channel in ('sms','email','voice','messenger','all')),
  identifier text not null,
  reason text not null,
  source_app_id text references public.apps(id),
  source_message_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (legal_entity_id, channel, identifier)
);
create index on public.suppressions (legal_entity_id, identifier);

create table public.suppression_audit (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  suppression_id uuid,
  action text not null,
  identifier text not null,
  channel text not null,
  actor_user_id uuid references public.users(id),
  actor_app_id text references public.apps(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  identifier text not null,
  channel text not null,
  basis text not null,
  captured_at timestamptz not null default now(),
  captured_by_app text references public.apps(id),
  evidence jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.consent_records (legal_entity_id, identifier);

-- ============ 3.6 brand / campaigns / numbers ============
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null unique references public.legal_entities(id) on delete cascade,
  provider text not null,
  provider_brand_id text,
  tcr_brand_id text,
  status text not null check (status in ('draft','submitted','verified','failed','suspended')),
  vertical text,
  submitted_at timestamptz,
  verified_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table public.campaigns_10dlc (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  app_id text not null references public.apps(id),
  use_case text not null,
  provider_campaign_id text,
  status text not null default 'draft',
  sample_messages text[],
  opt_in_description text,
  throughput_tpm int,
  created_at timestamptz not null default now(),
  unique (brand_id, app_id, use_case)
);

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  campaign_id uuid references public.campaigns_10dlc(id),
  e164 text not null unique,
  provider text not null,
  capabilities text[] not null default '{sms}',
  friendly_name text,
  status text not null default 'active',
  provisioned_at timestamptz not null default now()
);
create index on public.phone_numbers (workspace_id, status);

-- ============ 3.7 conversations / messages ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open',
  assigned_user_id uuid references public.users(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  app_id text not null references public.apps(id),
  channel text not null check (channel in ('sms','mms','email','voice','messenger')),
  direction text not null check (direction in ('outbound','inbound')),
  from_identifier text not null,
  to_identifier text not null,
  body text,
  media jsonb,
  segments int,
  provider_message_id text,
  status text not null,
  error_code text,
  policy_check_id uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);
create index on public.messages (workspace_id, created_at desc);

-- ============ 3.8 policy ============
create table public.policy_packs (
  id text primary key,
  name text not null,
  industry text,
  rules jsonb not null,
  created_at timestamptz not null default now()
);

create table public.workspace_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  policy_pack_ids text[] not null default '{us-sms-default}',
  overrides jsonb not null default '{}',
  autonomy_level int not null default 0 check (autonomy_level between 0 and 3)
);

create table public.policy_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  app_id text not null references public.apps(id),
  action text not null,
  channel text,
  identifier text,
  contact_id uuid references public.contacts(id) on delete set null,
  decision text not null check (decision in ('allow','deny')),
  rules_evaluated jsonb not null default '[]',
  denied_by text,
  actor_type text not null,
  actor_id text,
  created_at timestamptz not null default now()
);
create index on public.policy_checks (workspace_id, created_at desc);
create index on public.policy_checks (contact_id, created_at desc);

-- ============ 3.9 credits ============
create table public.credit_meters (
  id text primary key,
  name text not null,
  unit text not null,
  base_cost_cents numeric(10,4) not null
);

create table public.credit_balances (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meter_id text not null references public.credit_meters(id),
  balance numeric(14,4) not null default 0,
  primary key (workspace_id, meter_id)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  app_id text references public.apps(id),
  meter_id text not null references public.credit_meters(id),
  quantity numeric(14,4) not null,
  unit_cost_cents numeric(10,4) not null,
  markup_rate numeric(6,4) not null default 0,
  billed_cents numeric(12,2) not null,
  idempotency_key text unique,
  reference jsonb,
  created_at timestamptz not null default now()
);
create index on public.credit_ledger (workspace_id, created_at desc);
create index on public.credit_ledger (account_id, created_at desc);

create table public.reseller_markups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  meter_id text not null references public.credit_meters(id),
  markup_rate numeric(6,4) not null,
  unique (account_id, workspace_id, meter_id)
);

-- ============ grants + rls ============
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','legal_entities','workspaces','users','memberships','account_memberships',
    'apps','app_packs','app_credentials','entitlements','contacts','contact_phones','contact_emails',
    'suppressions','suppression_audit','consent_records','brands','campaigns_10dlc','phone_numbers',
    'conversations','messages','policy_packs','workspace_policies','policy_checks',
    'credit_meters','credit_balances','credit_ledger','reseller_markups'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "users read self or staff" on public.users for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "users update self" on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "staff manage users" on public.users for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "accounts read" on public.accounts for select to authenticated using (public.has_account_access(id));
create policy "accounts staff write" on public.accounts for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "entities read" on public.legal_entities for select to authenticated using (public.has_account_access(account_id));
create policy "entities staff write" on public.legal_entities for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "workspaces read" on public.workspaces for select to authenticated using (public.has_workspace_access(id));
create policy "workspaces staff write" on public.workspaces for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "memberships read" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_workspace_access(workspace_id));
create policy "memberships manage" on public.memberships for all to authenticated
  using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id));

create policy "account memberships read" on public.account_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_account_access(account_id));
create policy "account memberships staff write" on public.account_memberships for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['apps','app_packs','credit_meters','policy_packs'] loop
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s staff write" on public.%I for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))', t, t);
  end loop;
end $$;

create policy "app credentials staff only" on public.app_credentials for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['entitlements','phone_numbers','conversations','messages','workspace_policies','credit_balances','credit_ledger'] loop
    execute format('create policy "%s read" on public.%I for select to authenticated using (public.has_workspace_access(workspace_id))', t, t);
    execute format('create policy "%s write" on public.%I for all to authenticated using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id))', t, t);
  end loop;
end $$;

create policy "policy checks read" on public.policy_checks for select to authenticated
  using (public.has_workspace_access(workspace_id));
create policy "policy checks insert" on public.policy_checks for insert to authenticated
  with check (public.has_workspace_access(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['contacts','contact_phones','contact_emails','consent_records','brands','suppression_audit'] loop
    execute format('create policy "%s read" on public.%I for select to authenticated using (public.has_entity_access(legal_entity_id))', t, t);
    execute format('create policy "%s write" on public.%I for all to authenticated using (public.has_entity_access(legal_entity_id)) with check (public.has_entity_access(legal_entity_id))', t, t);
  end loop;
end $$;

create policy "suppressions read" on public.suppressions for select to authenticated
  using (public.has_entity_access(legal_entity_id));
create policy "suppressions insert" on public.suppressions for insert to authenticated
  with check (public.has_entity_access(legal_entity_id));
create policy "suppressions update" on public.suppressions for update to authenticated
  using (public.has_entity_access(legal_entity_id)) with check (public.has_entity_access(legal_entity_id));
create policy "suppressions staff delete" on public.suppressions for delete to authenticated
  using (public.is_staff(auth.uid()));

create policy "campaigns read" on public.campaigns_10dlc for select to authenticated
  using (exists (select 1 from public.brands b where b.id = brand_id and public.has_entity_access(b.legal_entity_id)));
create policy "campaigns write" on public.campaigns_10dlc for all to authenticated
  using (exists (select 1 from public.brands b where b.id = brand_id and public.has_entity_access(b.legal_entity_id)))
  with check (exists (select 1 from public.brands b where b.id = brand_id and public.has_entity_access(b.legal_entity_id)));

create policy "reseller markups read" on public.reseller_markups for select to authenticated
  using (public.has_account_access(account_id));
create policy "reseller markups write" on public.reseller_markups for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ============ idempotent credit consumption ============
create or replace function public.consume_credits(
  _workspace_id uuid, _meter_id text, _quantity numeric, _app_id text,
  _idempotency_key text, _reference jsonb
) returns public.credit_ledger
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.credit_ledger;
  v_account uuid;
  v_cost numeric(10,4);
  v_markup numeric(6,4);
  v_row public.credit_ledger;
begin
  select * into v_existing from public.credit_ledger where idempotency_key = _idempotency_key;
  if found then return v_existing; end if;

  select account_id into v_account from public.workspaces where id = _workspace_id;
  if v_account is null then raise exception 'workspace_not_found'; end if;
  select base_cost_cents into v_cost from public.credit_meters where id = _meter_id;
  if v_cost is null then raise exception 'meter_not_found'; end if;

  select markup_rate into v_markup from public.reseller_markups
   where account_id = v_account and meter_id = _meter_id
     and (workspace_id = _workspace_id or workspace_id is null)
   order by workspace_id nulls last limit 1;
  v_markup := coalesce(v_markup, 0);

  insert into public.credit_ledger (account_id, workspace_id, app_id, meter_id, quantity,
    unit_cost_cents, markup_rate, billed_cents, idempotency_key, reference)
  values (v_account, _workspace_id, _app_id, _meter_id, _quantity, v_cost, v_markup,
    round(abs(_quantity) * v_cost * (1 + v_markup) * (case when _quantity < 0 then 1 else -1 end)::numeric, 2),
    _idempotency_key, _reference)
  returning * into v_row;

  insert into public.credit_balances (workspace_id, meter_id, balance)
  values (_workspace_id, _meter_id, _quantity)
  on conflict (workspace_id, meter_id) do update set balance = public.credit_balances.balance + excluded.balance;

  return v_row;
end $$;

revoke all on function public.consume_credits(uuid,text,numeric,text,text,jsonb) from public;
grant execute on function public.consume_credits(uuid,text,numeric,text,text,jsonb) to service_role;

-- ============ seeds ============
insert into public.credit_meters (id, name, unit, base_cost_cents) values
  ('skip_trace','Skip Trace','lookup',12.0000),
  ('sms_segment','SMS Segment','segment',0.8000),
  ('phone_validation','Phone Validation','lookup',0.4000)
on conflict do nothing;

insert into public.policy_packs (id, name, industry, rules) values
  ('us-sms-default','US SMS Default', null, '{"quiet_hours":{"start":8,"end":21},"daily_cap_per_contact":3,"block_line_types":["landline"],"require_verified_brand":true,"max_autonomy":{"send":3,"offer":1,"negotiate":1,"sign":1,"call":2}}'),
  ('lending-us','Lending (US)','lending','{"quiet_hours":{"start":9,"end":20},"daily_cap_per_contact":2,"block_line_types":["landline","voip"],"require_verified_brand":true,"max_autonomy":{"send":2,"offer":0,"negotiate":0,"sign":0,"call":1}}'),
  ('insurance-us','Insurance (US)','insurance','{"quiet_hours":{"start":9,"end":20},"daily_cap_per_contact":2,"block_line_types":["landline"],"require_verified_brand":true,"max_autonomy":{"send":2,"offer":0,"negotiate":0,"sign":1,"call":1}}')
on conflict do nothing;

insert into public.apps (id, name, description, base_url, manifest, is_alacarte) values
  ('leadtrace','LeadTrace','Lead sourcing, skip trace, and outbound.','https://leadtrace.example.com','{"emits":["lead.created","lead.enriched","lead.replied","message.sent","message.received"],"consumes":["contact.updated","contact.opted_out"],"tools":[]}',true),
  ('master-closer','Master Closer','Deal pipeline and negotiation.','https://mastercloser.example.com','{"emits":["deal.created","deal.stage_changed","deal.won","deal.lost"],"consumes":["lead.qualified"],"tools":[]}',true),
  ('core-admin','Core Admin','Internal Core administration console.','https://admin.realelite.com','{"emits":[],"consumes":[]}',false)
on conflict do nothing;