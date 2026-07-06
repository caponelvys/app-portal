-- App catalog categories, for the user portal's "Browse & request" chips
-- (Communication / Design / Dev / …). Nullable; the UI groups untagged apps
-- under "Other". Admins set it in the app editor.
alter table public.apps add column if not exists category text;

create index if not exists idx_apps_category on public.apps (category);
