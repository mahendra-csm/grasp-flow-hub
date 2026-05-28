-- Create invitations and profiles tables and trigger to populate profiles from invitations

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  role text not null default 'employee',
  created_by uuid,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days'),
  used boolean default false
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'employee',
  name text,
  created_at timestamptz default now()
);

-- Trigger: when a new user is created in auth.users, check invitations table and create profile with role
create or replace function public.handle_new_user_create()
returns trigger language plpgsql security definer as $$
begin
  -- find invitation
  perform 1 from public.invitations where email = NEW.email and used = false and (expires_at is null or expires_at > now()) limit 1;
  if found then
    -- create profile with role from invitation
    insert into public.profiles (id, role, name) 
    select NEW.id, role, NEW.email from public.invitations where email = NEW.email and used = false limit 1
    on conflict (id) do nothing;
    -- mark invitation used
    update public.invitations set used = true where email = NEW.email and used = false;
  else
    -- create default profile
    insert into public.profiles (id, name) values (NEW.id, NEW.email) on conflict (id) do nothing;
  end if;
  return NEW;
end;
$$;

-- Attach trigger to auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_create();
