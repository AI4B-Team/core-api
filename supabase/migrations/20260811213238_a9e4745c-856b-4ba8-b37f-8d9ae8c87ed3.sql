create extension if not exists vector with schema extensions;

-- ============ recording consent rules ============
create table public.recording_consent_rules (
  state char(2) primary key,
  consent_type text not null check (consent_type in ('one_party','all_party')),
  statute_citation text,
  notes text,
  verified_by text,
  verified_at timestamptz,
  source_url text
);
grant select on public.recording_consent_rules to authenticated;
grant all on public.recording_consent_rules to service_role;
alter table public.recording_consent_rules enable row level security;
create policy "recording consent rules read" on public.recording_consent_rules for select to authenticated using (true);
create policy "recording consent rules staff write" on public.recording_consent_rules for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.recording_consent_rules (state, consent_type, statute_citation) values
  ('AL','one_party',null),('AK','one_party',null),('AZ','one_party',null),('AR','one_party',null),
  ('CA','all_party',null),('CO','one_party',null),('CT','all_party',null),('DE','all_party',null),
  ('DC','one_party',null),('FL','all_party','Fla. Stat. 934.03'),('GA','one_party',null),('HI','one_party',null),
  ('ID','one_party',null),('IL','all_party',null),('IN','one_party',null),('IA','one_party',null),
  ('KS','one_party',null),('KY','one_party',null),('LA','one_party',null),('ME','one_party',null),
  ('MD','all_party',null),('MA','all_party',null),('MI','all_party',null),('MN','one_party',null),
  ('MS','one_party',null),('MO','one_party',null),('MT','all_party',null),('NE','one_party',null),
  ('NV','all_party',null),('NH','all_party',null),('NJ','one_party',null),('NM','one_party',null),
  ('NY','one_party',null),('NC','one_party',null),('ND','one_party',null),('OH','one_party',null),
  ('OK','one_party',null),('OR','all_party',null),('PA','all_party',null),('RI','one_party',null),
  ('SC','one_party',null),('SD','one_party',null),('TN','one_party',null),('TX','one_party',null),
  ('UT','one_party',null),('VT','one_party',null),('VA','one_party',null),('WA','all_party',null),
  ('WV','one_party',null),('WI','one_party',null),('WY','one_party',null)
on conflict (state) do nothing;

-- ============ policy_checks: allow_with_announcement ============
alter table public.policy_checks drop constraint if exists policy_checks_decision_check;
alter table public.policy_checks add constraint policy_checks_decision_check
  check (decision in ('allow','allow_with_announcement','deny'));

-- ============ messages: voice fields ============
alter table public.messages
  add column if not exists duration_seconds int,
  add column if not exists recording_url text,
  add column if not exists recording_consent_state text
    check (recording_consent_state in ('announced','one_party','not_recorded')),
  add column if not exists transcript_id uuid;

-- ============ call sessions ============
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  direction text not null check (direction in ('outbound','inbound')),
  from_e164 text not null,
  to_e164 text not null,
  provider text,
  provider_call_id text,
  status text not null check (status in ('ringing','in_progress','completed','failed','no_answer','voicemail')),
  disposition text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  recorded boolean not null default false,
  policy_check_id uuid references public.policy_checks(id),
  created_at timestamptz not null default now()
);
create index on public.call_sessions (workspace_id, created_at desc);
create index on public.call_sessions (conversation_id, created_at desc);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  segments jsonb not null default '[]',
  full_text text,
  provider text,
  created_at timestamptz not null default now()
);
create index on public.call_transcripts (call_session_id);

create table public.call_participants (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id),
  external_e164 text,
  role text not null check (role in ('agent','contact','merged','transferred_to','supervisor_monitor','supervisor_whisper','supervisor_barge')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index on public.call_participants (call_session_id);

-- ============ knowledge base ============
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('upload','url','text')),
  file_path text,
  mime_type text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index on public.knowledge_documents (workspace_id, created_at desc);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index on public.knowledge_chunks (workspace_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_knowledge_chunks(
  _workspace_id uuid,
  _embedding extensions.vector(1536),
  _limit int default 8
)
returns table (
  id uuid, document_id uuid, chunk_index int, content text, similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.id, c.document_id, c.chunk_index, c.content,
         1 - (c.embedding <=> _embedding) as similarity
  from public.knowledge_chunks c
  where c.workspace_id = _workspace_id and c.embedding is not null
  order by c.embedding <=> _embedding
  limit greatest(1, least(coalesce(_limit, 8), 50))
$$;
revoke all on function public.match_knowledge_chunks(uuid, extensions.vector, int) from public;
grant execute on function public.match_knowledge_chunks(uuid, extensions.vector, int) to service_role;

-- ============ live assist ============
create table public.assist_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  industry text,
  triggers jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.assist_playbooks (workspace_id);

create table public.assist_events (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  trigger_text text,
  suggestion_type text not null check (suggestion_type in ('objection','knowledge_answer','script_prompt','compliance_reminder')),
  suggestion text not null,
  knowledge_chunk_ids uuid[] not null default '{}',
  latency_ms int,
  surfaced boolean not null default false,
  acted_on boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.assist_events (call_session_id, created_at desc);

-- ============ extraction ============
create table public.extraction_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null check (source_type in ('call','sms_thread')),
  source_id uuid not null,
  schema_id text,
  fields jsonb not null default '{}',
  confidence jsonb not null default '{}',
  summary text,
  proposed_disposition text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.extraction_results (workspace_id, created_at desc);
create index on public.extraction_results (source_type, source_id);

-- ============ grants + rls for workspace-scoped tables ============
do $$
declare t text;
begin
  foreach t in array array['call_sessions','call_transcripts','call_participants','knowledge_documents','knowledge_chunks','assist_playbooks','assist_events','extraction_results'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (public.has_workspace_access(workspace_id))', t, t);
    execute format('create policy "%s write" on public.%I for all to authenticated using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id))', t, t);
  end loop;
end $$;

-- ============ credit meters ============
insert into public.credit_meters (id, name, unit, base_cost_cents) values
  ('call_minute','Call Minute','minute',1.2000),
  ('recording_storage_minute','Recording Storage Minute','minute',0.0500),
  ('transcription_minute','Transcription Minute','minute',0.6000),
  ('assist_request','Assist Request','request',0.2000),
  ('knowledge_embedding','Knowledge Embedding','chunk',0.0100)
on conflict (id) do nothing;