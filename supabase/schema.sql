-- Empty website-specific tables only. No local user/session rows are imported.
-- Stop if either name already exists: do not alter unknown tables.
begin;

create table public.website_users (
  id uuid primary key,
  username text not null check (char_length(username) between 1 and 24),
  username_key text not null unique,
  salt text not null check (salt ~ '^[0-9a-f]{32}$'),
  password_hash text not null check (password_hash ~ '^[0-9a-f]{128}$'),
  created_at timestamptz not null default now()
);

create table public.website_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.website_users(id),
  expires_at bigint not null check (expires_at > 0),
  created_at timestamptz not null default now()
);
create index website_sessions_expiry_idx on public.website_sessions (expires_at);

alter table public.website_users enable row level security;
alter table public.website_sessions enable row level security;
revoke all on table public.website_users, public.website_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.website_users, public.website_sessions to service_role;

comment on table public.website_users is 'Server-only website nickname and salted password hashes. Not Supabase Auth users.';
comment on table public.website_sessions is 'Server-only hashed login tokens; no plaintext token storage.';

commit;

-- Verify flags and privileges without reading account records.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
  (has_table_privilege('service_role', c.oid, 'SELECT')
    and has_table_privilege('service_role', c.oid, 'INSERT')
    and has_table_privilege('service_role', c.oid, 'UPDATE')
    and has_table_privilege('service_role', c.oid, 'DELETE')) as server_can_access
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('website_users', 'website_sessions')
order by c.relname;
