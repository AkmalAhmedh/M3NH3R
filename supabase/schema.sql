-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Couples Table (Basic Definition)
create table public.couples (
    id uuid primary key default gen_random_uuid(),
    name text,
    anniversary_date date,
    user1_id uuid,
    user2_id uuid,
    status text default 'active' not null, -- active, breakup_pending, ended
    shared_key text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    ended_at timestamp with time zone,
    breakup_initiator_id uuid
);

-- Enable RLS for Couples
alter table public.couples enable row level security;

-- 2. Profiles Table
create table public.profiles (
    id uuid primary key references auth.users on delete cascade,
    couple_id uuid references public.couples(id) on delete set null,
    email text,
    username text,
    avatar_url text,
    mood text,
    mood_emoji text,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

-- Add circular reference foreign key constraints to Couples Table
alter table public.couples add constraint fk_couples_user1 foreign key (user1_id) references public.profiles(id) on delete set null;
alter table public.couples add constraint fk_couples_user2 foreign key (user2_id) references public.profiles(id) on delete set null;
alter table public.couples add constraint fk_couples_breakup_initiator foreign key (breakup_initiator_id) references public.profiles(id) on delete set null;

-- Helper Function to fetch current user's couple_id
create or replace function public.get_user_couple_id()
returns uuid 
security definer
stable
set search_path = public
as $$
declare
  c_id uuid;
begin
  select couple_id into c_id from public.profiles where id = auth.uid();
  return c_id;
end;
$$ language plpgsql;

-- RLS Policies for Couples
create policy "Users can view couples"
    on public.couples for select
    using (auth.role() = 'authenticated');

create policy "Users can update their own couple"
    on public.couples for update
    using (id = public.get_user_couple_id());

create policy "Users can insert couples"
    on public.couples for insert
    with check (auth.role() = 'authenticated');

-- RLS Policies for Profiles
create policy "Users can view profiles"
    on public.profiles for select
    using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
    on public.profiles for insert
    with check (id = auth.uid());

create policy "Users can update their own profile"
    on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

create policy "Users can link their partner profile"
    on public.profiles for update
    using (couple_id is null)
    with check (couple_id = public.get_user_couple_id());

create policy "Users can disconnect their partner"
    on public.profiles for update
    using (couple_id = public.get_user_couple_id())
    with check (couple_id is null);

-- Trigger for new auth user to auto-insert profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Partner Invites Table
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


-- 4. Memories & Assets
create table public.memories (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    content text,
    category text not null, -- Movie, Game, Food, Travel, Call, Date, Gift, Personal
    date date not null,
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null
);

alter table public.memories enable row level security;

create policy "Couple access memories"
    on public.memories for all
    using (couple_id = public.get_user_couple_id());

create table public.memory_assets (
    id uuid primary key default gen_random_uuid(),
    memory_id uuid references public.memories(id) on delete cascade not null,
    file_path text not null,
    file_type text not null, -- image, video, audio
    created_at timestamp with time zone default now() not null
);

alter table public.memory_assets enable row level security;

create policy "Couple access memory assets"
    on public.memory_assets for all
    using (
        exists (
            select 1 from public.memories m 
            where m.id = memory_id and m.couple_id = public.get_user_couple_id()
        )
    );


-- 5. Sandbox Cards
create table public.sandbox_cards (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    status text not null, -- wishlist, right_now, core_memories
    category text not null,
    metadata jsonb default '{}'::jsonb not null,
    order_index integer default 0 not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

alter table public.sandbox_cards enable row level security;

create policy "Couple access sandbox cards"
    on public.sandbox_cards for all
    using (couple_id = public.get_user_couple_id());


-- 6. Drawings & Assets
create table public.drawings (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    name text not null,
    thumbnail_url text,
    canvas_data jsonb not null, -- JSON array of points/lines
    is_pinned boolean default false not null, -- for refrigerator door
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

alter table public.drawings enable row level security;

create policy "Couple access drawings"
    on public.drawings for all
    using (couple_id = public.get_user_couple_id());

create table public.drawing_assets (
    id uuid primary key default gen_random_uuid(),
    drawing_id uuid references public.drawings(id) on delete cascade not null,
    asset_path text not null,
    created_at timestamp with time zone default now() not null
);

alter table public.drawing_assets enable row level security;

create policy "Couple access drawing assets"
    on public.drawing_assets for all
    using (
        exists (
            select 1 from public.drawings d 
            where d.id = drawing_id and d.couple_id = public.get_user_couple_id()
        )
    );


-- 7. Mood Logs
create table public.mood_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    mood text not null,
    mood_emoji text not null,
    notes text,
    created_at timestamp with time zone default now() not null
);

alter table public.mood_logs enable row level security;

create policy "Couple access mood logs"
    on public.mood_logs for select
    using (
        user_id = auth.uid() or 
        exists (
            select 1 from public.profiles p 
            where p.id = user_id and p.couple_id = public.get_user_couple_id()
        )
    );

create policy "Users can insert their own mood logs"
    on public.mood_logs for insert
    with check (user_id = auth.uid());


-- 8. Wants (Preferences)
create table public.wants (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    content text not null,
    is_sensitive boolean default false not null,
    category text not null, -- cravings, future plans, activities, emotional needs, wishlist
    created_at timestamp with time zone default now() not null
);

alter table public.wants enable row level security;

create policy "Couple access wants"
    on public.wants for all
    using (couple_id = public.get_user_couple_id());


-- 9. Wishlists
create table public.wishlists (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    category text not null,
    order_index integer default 0 not null,
    created_at timestamp with time zone default now() not null
);

alter table public.wishlists enable row level security;

create policy "Couple access wishlists"
    on public.wishlists for all
    using (couple_id = public.get_user_couple_id());


-- 10. Movies
create table public.movies (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    type text not null, -- movie, series
    rating integer check (rating >= 1 and rating <= 5),
    review text,
    poster_url text,
    watched_at date not null,
    created_at timestamp with time zone default now() not null
);

alter table public.movies enable row level security;

create policy "Couple access movies"
    on public.movies for all
    using (couple_id = public.get_user_couple_id());


-- 11. Games
create table public.games (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    hours_played numeric default 0 not null,
    screenshot_url text,
    notes text,
    played_at date not null,
    created_at timestamp with time zone default now() not null
);

alter table public.games enable row level security;

create policy "Couple access games"
    on public.games for all
    using (couple_id = public.get_user_couple_id());


-- 12. Locations
create table public.locations (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    name text not null,
    type text not null, -- meetup, restaurant, cafe, trip
    lat numeric not null,
    lng numeric not null,
    note text,
    visited_at date not null,
    created_at timestamp with time zone default now() not null
);

alter table public.locations enable row level security;

create policy "Couple access locations"
    on public.locations for all
    using (couple_id = public.get_user_couple_id());


-- 13. Journals
create table public.journals (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    content text,
    audio_url text,
    emoji text,
    date date not null,
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null
);

alter table public.journals enable row level security;

create policy "Couple access journals"
    on public.journals for all
    using (couple_id = public.get_user_couple_id());


-- 14. Voice Capsules
create table public.voice_capsules (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    file_path text not null,
    category text not null, -- good_morning, good_night, anniversary, custom
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null
);

alter table public.voice_capsules enable row level security;

create policy "Couple access voice capsules"
    on public.voice_capsules for all
    using (couple_id = public.get_user_couple_id());


-- 15. Love Letters (Lock until date)
create table public.love_letters (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    recipient_id uuid references public.profiles(id) on delete cascade not null,
    content text not null,
    unlock_date date not null,
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null
);

alter table public.love_letters enable row level security;

-- A recipient can read a love letter only if current date is at or after unlock_date.
-- The creator can always read/write.
create policy "Couple read love letters with conditions"
    on public.love_letters for select
    using (
        couple_id = public.get_user_couple_id() and (
            created_by = auth.uid() or 
            unlock_date <= current_date
        )
    );

create policy "Users can create love letters"
    on public.love_letters for insert
    with check (couple_id = public.get_user_couple_id() and created_by = auth.uid());

create policy "Users can update/delete their own created love letters"
    on public.love_letters for all
    using (couple_id = public.get_user_couple_id() and created_by = auth.uid());


-- 16. Time Capsules
create table public.time_capsules (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    title text not null,
    content text,
    assets_paths jsonb default '[]'::jsonb not null,
    unlock_date date not null,
    created_by uuid references public.profiles(id) on delete set null not null,
    created_at timestamp with time zone default now() not null
);

alter table public.time_capsules enable row level security;

-- Time capsule elements are locked until unlock_date for the partner, but the creator can see them anytime.
create policy "Couple read time capsules with conditions"
    on public.time_capsules for select
    using (
        couple_id = public.get_user_couple_id() and (
            created_by = auth.uid() or 
            unlock_date <= current_date
        )
    );

create policy "Users can create time capsules"
    on public.time_capsules for insert
    with check (couple_id = public.get_user_couple_id() and created_by = auth.uid());

create policy "Users can manage their own created time capsules"
    on public.time_capsules for all
    using (couple_id = public.get_user_couple_id() and created_by = auth.uid());


-- 17. Notifications (Allows null couple_id for connection stage)
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade,
    recipient_id uuid references public.profiles(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete cascade not null,
    type text not null,
    message text not null,
    is_read boolean default false not null,
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null
);

alter table public.notifications enable row level security;

create policy "Couple read/write notifications"
    on public.notifications for all
    using (couple_id = public.get_user_couple_id());

create policy "Users can read their own notifications regardless of couple"
    on public.notifications for select
    using (recipient_id = auth.uid());

create policy "Users can update their own notifications"
    on public.notifications for update
    using (recipient_id = auth.uid());


-- 18. Achievements
create table public.achievements (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    name text not null,
    description text not null,
    unlocked_at timestamp with time zone default now() not null,
    criteria_type text not null,
    created_at timestamp with time zone default now() not null
);

alter table public.achievements enable row level security;

create policy "Couple access achievements"
    on public.achievements for all
    using (couple_id = public.get_user_couple_id());


-- 19. Safe Space (Pin code locked area)
create table public.safe_space (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null unique,
    pin_hash text not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

alter table public.safe_space enable row level security;

create policy "Couple access safe space"
    on public.safe_space for all
    using (couple_id = public.get_user_couple_id());


-- 20. Triggers to update updated_at columns
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_couples_updated_at before update on public.couples for each row execute procedure public.update_updated_at_column();
create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at_column();
create trigger update_sandbox_cards_updated_at before update on public.sandbox_cards for each row execute procedure public.update_updated_at_column();
create trigger update_drawings_updated_at before update on public.drawings for each row execute procedure public.update_updated_at_column();
create trigger update_safe_space_updated_at before update on public.safe_space for each row execute procedure public.update_updated_at_column();


-- 21. RPC: Request Connection
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
  values (
    null, invite_record.owner_id, requester_id, 'connection_request', 
    'Someone wants to connect with you.', 
    jsonb_build_object('invite_id', invite_record.id)
  );

  return jsonb_build_object('success', true, 'invite_id', invite_record.id);
end;
$$ language plpgsql;

grant execute on function public.request_partner_connection(text) to public;

-- 22. RPC: Accept Connection
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

  return jsonb_build_object('success', true, 'couple_id', new_couple_id);
end;
$$ language plpgsql;

grant execute on function public.accept_partner_connection(uuid) to public;

-- 23. RPC: Decline Connection
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
  select * into invite_record from public.partner_invites where id = invite_id_input;
  if invite_record.owner_id != owner_uid then raise exception 'Not authorized'; end if;

  update public.partner_invites set status = 'declined' where id = invite_id_input;

  -- Notify requester
  insert into public.notifications (recipient_id, sender_id, type, message)
  values (invite_record.target_user_id, owner_uid, 'connection_declined', 'Your connection request was declined.');

  return jsonb_build_object('success', true);
end;
$$ language plpgsql;

grant execute on function public.decline_partner_connection(uuid) to public;

-- 24. RPC: Initiate Breakup
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


-- 25. RPC: Respond to Breakup
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


-- 26. Performance indexes
create index if not exists idx_profiles_couple_id on public.profiles(couple_id);
create index if not exists idx_partner_invites_owner_id on public.partner_invites(owner_id);
create index if not exists idx_partner_invites_code on public.partner_invites(code);
create index if not exists idx_memories_couple_id on public.memories(couple_id);
create index if not exists idx_memory_assets_memory_id on public.memory_assets(memory_id);
create index if not exists idx_sandbox_cards_couple_id on public.sandbox_cards(couple_id);
create index if not exists idx_drawings_couple_id on public.drawings(couple_id);
create index if not exists idx_drawing_assets_drawing_id on public.drawing_assets(drawing_id);
create index if not exists idx_mood_logs_user_id on public.mood_logs(user_id);
create index if not exists idx_wants_couple_id on public.wants(couple_id);
create index if not exists idx_movies_couple_id on public.movies(couple_id);
create index if not exists idx_games_couple_id on public.games(couple_id);
create index if not exists idx_locations_couple_id on public.locations(couple_id);
create index if not exists idx_journals_couple_id on public.journals(couple_id);
create index if not exists idx_voice_capsules_couple_id on public.voice_capsules(couple_id);
create index if not exists idx_love_letters_couple_id on public.love_letters(couple_id);
create index if not exists idx_time_capsules_couple_id on public.time_capsules(couple_id);
create index if not exists idx_notifications_couple_id_recipient_id on public.notifications(couple_id, recipient_id);
create index if not exists idx_achievements_couple_id on public.achievements(couple_id);

-- 27. Realtime Publication
-- Ensure realtime is enabled for tables that require instant UI updates (like invites and profiles)
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.partner_invites;
