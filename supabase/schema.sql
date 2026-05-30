-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Couples Table
create table public.couples (
    id uuid primary key default gen_random_uuid(),
    name text,
    anniversary_date date,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
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

-- Helper Function to fetch current user's couple_id
create or replace function public.get_user_couple_id()
returns uuid as $$
  select couple_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- RLS Policies for Couples
create policy "Users can view their own couple"
    on public.couples for select
    using (id = public.get_user_couple_id());

create policy "Users can update their own couple"
    on public.couples for update
    using (id = public.get_user_couple_id());

create policy "Users can insert couples"
    on public.couples for insert
    with check (auth.role() = 'authenticated');

-- RLS Policies for Profiles
create policy "Users can view their own profile or partner's profile"
    on public.profiles for select
    using (id = auth.uid() or couple_id = public.get_user_couple_id());

create policy "Users can update their own profile or partner link"
    on public.profiles for update
    using (id = auth.uid() or couple_id is null);

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


-- 3. Invite Codes
create table public.invite_codes (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    issuer_id uuid references public.profiles(id) on delete cascade not null,
    is_used boolean default false not null,
    created_at timestamp with time zone default now() not null
);

alter table public.invite_codes enable row level security;

create policy "Anyone can read invite codes"
    on public.invite_codes for select
    using (true);

create policy "Users can insert their own invite codes"
    on public.invite_codes for insert
    with check (issuer_id = auth.uid());

create policy "Anyone can update invite codes to redeem them"
    on public.invite_codes for update
    using (auth.role() = 'authenticated');


-- 4. Breakup Requests
create table public.breakup_requests (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
    initiator_id uuid references public.profiles(id) on delete cascade not null,
    status text default 'pending' not null, -- pending, accepted, declined
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

alter table public.breakup_requests enable row level security;

create policy "Users can view breakup requests for their couple"
    on public.breakup_requests for select
    using (couple_id = public.get_user_couple_id());

create policy "Users can create breakup requests for their couple"
    on public.breakup_requests for insert
    with check (couple_id = public.get_user_couple_id() and initiator_id = auth.uid());

create policy "Users can update breakup requests for their couple"
    on public.breakup_requests for update
    using (couple_id = public.get_user_couple_id());


-- 5. Memories & Assets
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


-- 6. Sandbox Cards
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


-- 7. Drawings & Assets
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


-- 8. Mood Logs
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


-- 9. Wants (Preferences)
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


-- 10. Wishlists
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


-- 11. Movies
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


-- 12. Games
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


-- 13. Locations
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


-- 14. Journals
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


-- 15. Voice Capsules
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


-- 16. Love Letters (Lock until date)
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


-- 17. Time Capsules
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


-- 18. Notifications
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid references public.couples(id) on delete cascade not null,
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


-- 19. Achievements
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


-- 20. Safe Space (Pin code locked area)
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


-- Triggers to update updated_at columns
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_couples_updated_at before update on public.couples for each row execute procedure public.update_updated_at_column();
create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at_column();
create trigger update_breakup_requests_updated_at before update on public.breakup_requests for each row execute procedure public.update_updated_at_column();
create trigger update_sandbox_cards_updated_at before update on public.sandbox_cards for each row execute procedure public.update_updated_at_column();
create trigger update_drawings_updated_at before update on public.drawings for each row execute procedure public.update_updated_at_column();
create trigger update_safe_space_updated_at before update on public.safe_space for each row execute procedure public.update_updated_at_column();
