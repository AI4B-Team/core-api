create table public.auth_codes (
  code_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  app_id text not null references public.apps(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.refresh_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  app_id text not null references public.apps(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

grant all on public.auth_codes to service_role;
grant all on public.refresh_tokens to service_role;
alter table public.auth_codes enable row level security;
alter table public.refresh_tokens enable row level security;

revoke execute on function public.is_staff(uuid) from anon;
revoke execute on function public.has_account_access(uuid) from anon;
revoke execute on function public.has_workspace_access(uuid) from anon;
revoke execute on function public.can_manage_workspace(uuid) from anon;
revoke execute on function public.has_entity_access(uuid) from anon;