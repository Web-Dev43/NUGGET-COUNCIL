-- NUGGET COUNCIL initial database schema.
-- Safe to run in Supabase SQL Editor on a fresh project.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 180),
  owner_id uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique check (char_length(join_code) = 5),
  created_at timestamptz not null default now()
);

create table if not exists public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists server_members_user_idx on public.server_members(user_id);
create index if not exists messages_server_created_idx on public.messages(server_id, created_at);
create index if not exists servers_owner_id_idx on public.servers(owner_id);
create index if not exists messages_user_id_idx on public.messages(user_id);

-- These helpers live outside the exposed API schema.
create or replace function private.is_server_member(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.server_members sm
    where sm.server_id = p_id and sm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_server_owner(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.servers s
    where s.id = p_id and s.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.is_server_member(uuid) from public, anon;
revoke all on function private.is_server_owner(uuid) from public, anon;
grant execute on function private.is_server_member(uuid) to authenticated;
grant execute on function private.is_server_owner(uuid) to authenticated;

-- Automatically add the creator as the first member of their server.
create or replace function public.add_server_owner_as_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.server_members(server_id, user_id)
  values (new.id, new.owner_id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.add_server_owner_as_member() from public, anon, authenticated;
drop trigger if exists on_server_created_add_owner on public.servers;
create trigger on_server_created_add_owner
after insert on public.servers for each row
execute function public.add_server_owner_as_member();

-- Create a server only for the authenticated caller.
-- The function sets owner_id from auth.uid() itself, never from client input.
create or replace function public.create_server(
  p_name text,
  p_description text,
  p_join_code text
)
returns public.servers
language plpgsql
security definer
set search_path = ''
as $
declare
  v_user_id uuid := auth.uid();
  v_server public.servers;
begin
  if v_user_id is null then
    raise exception 'Authentication token was not received by the database'
      using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Server name is required' using errcode = '22023';
  end if;
  insert into public.servers (name, description, owner_id, join_code)
  values (trim(p_name), coalesce(p_description, ''), v_user_id, p_join_code)
  returning * into v_server;
  return v_server;
end;
$;
revoke all on function public.create_server(text, text, text) from public, anon;
grant execute on function public.create_server(text, text, text) to authenticated;

-- The private SECURITY DEFINER function validates the invite and adds membership.
create or replace function private.join_server(p_join_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_server_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to join a server'; end if;
  select s.id into v_server_id from public.servers s
  where upper(s.join_code) = upper(trim(p_join_code)) limit 1;
  if v_server_id is null then raise exception 'Invite code not found'; end if;
  insert into public.server_members(server_id, user_id)
  values (v_server_id, v_user_id) on conflict do nothing;
  return v_server_id;
end;
$$;
revoke all on function private.join_server(text) from public, anon;
grant execute on function private.join_server(text) to authenticated;

-- Public RPC wrapper is SECURITY INVOKER; privileged work stays private.
create or replace function public.join_server(p_join_code text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.join_server(p_join_code); $$;
revoke all on function public.join_server(text) from public, anon;
grant execute on function public.join_server(text) to authenticated;

alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Members read servers" on public.servers;
create policy "Members read servers" on public.servers
for select to authenticated using (private.is_server_member(id));

drop policy if exists "Users create own servers" on public.servers;
create policy "Users create own servers" on public.servers
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "Owners update servers" on public.servers;
create policy "Owners update servers" on public.servers
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners delete servers" on public.servers;
create policy "Owners delete servers" on public.servers
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Members read member list" on public.server_members;
create policy "Members read member list" on public.server_members
for select to authenticated using (private.is_server_member(server_id));

drop policy if exists "Users leave servers" on public.server_members;
create policy "Users leave servers" on public.server_members
for delete to authenticated using (
  user_id = (select auth.uid()) and not private.is_server_owner(server_id)
);

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages
for select to authenticated using (private.is_server_member(server_id));

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages" on public.messages
for insert to authenticated with check (
  user_id = (select auth.uid()) and private.is_server_member(server_id)
);

-- Explicit least-privilege table grants; RLS still applies.
revoke all on public.servers, public.server_members, public.messages from anon;
grant select, insert, update, delete on public.servers to authenticated;
grant select, delete on public.server_members to authenticated;
grant select, insert on public.messages to authenticated;

-- Enable live message inserts for Supabase Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

-- Rooms are invite-only. Membership is granted through join_server.
-- Never expose a service_role or secret key in browser code.
