-- Create smart_links table to store music smart links
create table if not exists public.smart_links (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  artist text,
  artwork_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create platforms table to store platform links for each smart link
create table if not exists public.platform_links (
  id uuid primary key default gen_random_uuid(),
  smart_link_id uuid not null references public.smart_links(id) on delete cascade,
  platform text not null, -- e.g., 'spotify', 'apple-music', 'youtube', 'soundcloud'
  url text not null,
  created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index if not exists idx_smart_links_slug on public.smart_links(slug);
create index if not exists idx_platform_links_smart_link_id on public.platform_links(smart_link_id);

-- Enable Row Level Security
alter table public.smart_links enable row level security;
alter table public.platform_links enable row level security;

-- Allow anyone to read smart links (public viewing)
create policy "smart_links_select_all"
  on public.smart_links for select
  using (true);

-- Allow anyone to create smart links (no auth required for now)
create policy "smart_links_insert_all"
  on public.smart_links for insert
  with check (true);

-- Allow anyone to update their smart links
create policy "smart_links_update_all"
  on public.smart_links for update
  using (true);

-- Allow anyone to read platform links (public viewing)
create policy "platform_links_select_all"
  on public.platform_links for select
  using (true);

-- Allow anyone to create platform links
create policy "platform_links_insert_all"
  on public.platform_links for insert
  with check (true);

-- Allow anyone to delete platform links
create policy "platform_links_delete_all"
  on public.platform_links for delete
  using (true);
