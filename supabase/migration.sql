-- 1. Modify Profiles Table
alter table public.profiles drop column if exists pending_partner_id;

-- 2. Modify Couples Table
alter table public.couples add column if not exists user1_id uuid references public.profiles(id) on delete set null;
alter table public.couples add column if not exists user2_id uuid references public.profiles(id) on delete set null;
alter table public.couples add column if not exists status text default 'active' not null;
alter table public.couples add column if not exists shared_key text;
alter table public.couples add column if not exists ended_at timestamp with time zone;
alter table public.couples add column if not exists breakup_initiator_id uuid references public.profiles(id) on delete set null;

-- Backfill existing couples if necessary (assuming they are still active)
update public.couples set status = 'active' where status is null;

-- 3. Drop existing breakup_requests and invite_codes (WARNING: Destructive, but requested for the new architecture)
drop table if exists public.breakup_requests cascade;
drop table if exists public.invite_codes cascade;

-- 4. Create Partner Invites Table
create table public.partner_invites (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    target_user_id uuid references public.profiles(id) on delete cascade,
    status text default 'pending' not null, -- pending, accepted, declined, expired
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default now() not null
);

alter table public.partner_invites enable row level security;

create policy "Users can view invites they own or are targeted for"
    on public.partner_invites for select
    using (auth.uid() = owner_id or auth.uid() = target_user_id or status = 'pending');

create policy "Users can insert their own invites"
    on public.partner_invites for insert
    with check (owner_id = auth.uid());

create policy "Users can update their own invites or targeted ones"
    on public.partner_invites for update
    using (auth.uid() = owner_id or auth.uid() = target_user_id);

create policy "Anyone can delete invites"
    on public.partner_invites for delete
    using (auth.uid() = owner_id);

-- 5. Drop old RPC function
drop function if exists public.link_partner_mutual;

-- 6. New RPC: Request Connection
create or replace function public.request_partner_connection(invite_code_input text)
returns jsonb
security definer
set search_path = public
as $$
declare
  requester_id uuid;
  invite_record record;
  requester_couple_id uuid;
  owner_couple_id uuid;
begin
  requester_id := auth.uid();
  if requester_id is null then raise exception 'Not authenticated'; end if;

  select * into invite_record from public.partner_invites 
  where code = invite_code_input and status = 'pending' and expires_at > now();

  if not found then raise exception 'Invalid or expired invite code'; end if;
  if invite_record.owner_id = requester_id then raise exception 'Cannot connect to yourself'; end if;

  -- Ensure neither has an active couple
  select couple_id into requester_couple_id from public.profiles where id = requester_id;
  select couple_id into owner_couple_id from public.profiles where id = invite_record.owner_id;

  if requester_couple_id is not null then raise exception 'You are already in an active connection'; end if;
  if owner_couple_id is not null then raise exception 'This user is already in an active connection'; end if;

  -- Update the invite to target this requester
  update public.partner_invites 
  set target_user_id = requester_id
  where id = invite_record.id;

  -- Notify the owner
  insert into public.notifications (couple_id, recipient_id, sender_id, type, message, metadata)
  -- we use a temporary placeholder for couple_id since they don't have one yet, or we can make couple_id nullable for notifications?
  -- Wait! Notifications currently requires couple_id not null!
  -- We MUST alter notifications table to allow null couple_id for pre-couple notifications!
  values (
    null, invite_record.owner_id, requester_id, 'connection_request', 
    'Someone wants to connect with you.', 
    jsonb_build_object('invite_id', invite_record.id)
  );

  return jsonb_build_object('success', true, 'invite_id', invite_record.id);
end;
$$ language plpgsql;

grant execute on function public.request_partner_connection(text) to public;

-- ALTER notifications table to allow null couple_id for connection requests
alter table public.notifications alter column couple_id drop not null;
create policy "Users can read their own notifications regardless of couple"
    on public.notifications for select
    using (recipient_id = auth.uid());
create policy "Users can update their own notifications"
    on public.notifications for update
    using (recipient_id = auth.uid());


-- 7. New RPC: Accept Connection
create or replace function public.accept_partner_connection(invite_id_input uuid)
returns jsonb
security definer
set search_path = public
as $$
declare
  owner_uid uuid;
  invite_record record;
  requester_couple_id uuid;
  owner_couple_id uuid;
  new_couple_id uuid;
  new_shared_key text;
begin
  owner_uid := auth.uid();
  if owner_uid is null then raise exception 'Not authenticated'; end if;

  select * into invite_record from public.partner_invites where id = invite_id_input;
  if not found then raise exception 'Invite not found'; end if;
  if invite_record.owner_id != owner_uid then raise exception 'Not authorized'; end if;
  if invite_record.target_user_id is null then raise exception 'No user has requested this code yet'; end if;
  if invite_record.status != 'pending' then raise exception 'Invite is no longer pending'; end if;

  select couple_id into owner_couple_id from public.profiles where id = owner_uid;
  select couple_id into requester_couple_id from public.profiles where id = invite_record.target_user_id;

  if owner_couple_id is not null or requester_couple_id is not null then 
    raise exception 'One or both users already have an active connection'; 
  end if;

  -- Generate shared key
  new_shared_key := md5(random()::text || clock_timestamp()::text);

  -- Create couple
  insert into public.couples (name, user1_id, user2_id, status, shared_key, anniversary_date)
  values ('Our Shared Universe', owner_uid, invite_record.target_user_id, 'active', new_shared_key, current_date)
  returning id into new_couple_id;

  -- Update profiles
  update public.profiles set couple_id = new_couple_id where id in (owner_uid, invite_record.target_user_id);

  -- Update invite
  update public.partner_invites set status = 'accepted' where id = invite_id_input;

  -- Expire all other pending invites for both users
  update public.partner_invites set status = 'expired' 
  where (owner_id in (owner_uid, invite_record.target_user_id) or target_user_id in (owner_uid, invite_record.target_user_id))
  and id != invite_id_input and status = 'pending';

  -- Create first memory
  insert into public.memories (couple_id, title, content, category, date, created_by)
  values (new_couple_id, 'Connection Day', 'A new universe has been created.', 'Personal', current_date, owner_uid);

  -- Notify requester that their request was accepted
  insert into public.notifications (couple_id, recipient_id, sender_id, type, message, metadata)
  values (new_couple_id, invite_record.target_user_id, owner_uid, 'connection_accepted', 
          'Your connection request was accepted! A new universe has been created.', 
          jsonb_build_object('couple_id', new_couple_id, 'invite_id', invite_id_input));

  return jsonb_build_object('success', true, 'couple_id', new_couple_id);
end;
$$ language plpgsql;

grant execute on function public.accept_partner_connection(uuid) to public;

-- 8. New RPC: Decline Connection
create or replace function public.decline_partner_connection(invite_id_input uuid)
returns jsonb
security definer
set search_path = public
as $$
declare
  owner_uid uuid;
  invite_record record;
begin
  owner_uid := auth.uid();
  if owner_uid is null then raise exception 'Not authenticated'; end if;
  
  select * into invite_record from public.partner_invites where id = invite_id_input;
  if not found then raise exception 'Invite not found'; end if;
  if invite_record.owner_id != owner_uid then raise exception 'Not authorized'; end if;
  if invite_record.target_user_id is null then raise exception 'No user has requested this code yet'; end if;

  update public.partner_invites set status = 'declined' where id = invite_id_input;

  -- Notify requester only if they exist
  if invite_record.target_user_id is not null then
    insert into public.notifications (recipient_id, sender_id, type, message, metadata)
    values (invite_record.target_user_id, owner_uid, 'connection_declined', 'Your connection request was declined.', 
            jsonb_build_object('invite_id', invite_record.id));
  end if;

  return jsonb_build_object('success', true);
end;
$$ language plpgsql;

grant execute on function public.decline_partner_connection(uuid) to public;

-- 9. New RPC: Initiate Breakup
create or replace function public.initiate_breakup()
returns jsonb
security definer
set search_path = public
as $$
declare
  c_id uuid;
begin
  select couple_id into c_id from public.profiles where id = auth.uid();
  if c_id is null then raise exception 'No active connection'; end if;

  update public.couples set status = 'breakup_pending', breakup_initiator_id = auth.uid() where id = c_id;
  return jsonb_build_object('success', true);
end;
$$ language plpgsql;

-- 10. New RPC: Respond to Breakup
create or replace function public.respond_to_breakup(accept boolean)
returns jsonb
security definer
set search_path = public
as $$
declare
  c_id uuid;
begin
  select couple_id into c_id from public.profiles where id = auth.uid();
  if c_id is null then raise exception 'No active connection'; end if;

  if accept then
    update public.couples set status = 'ended', ended_at = now() where id = c_id;
    update public.profiles set couple_id = null where couple_id = c_id;
  else
    update public.couples set status = 'active', breakup_initiator_id = null where id = c_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$ language plpgsql;
