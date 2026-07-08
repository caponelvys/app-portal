-- M3 CP4: policy templates — reusable named sets of app→status entries an MSP
-- can apply to any scope in one action (e.g. a "Standard blocklist" applied to
-- every new client). Templates are shared MSP-level definitions (no org_id);
-- applying one writes app_policies at the chosen scope (and logs to history).
-- Portal-only (service-role).

create table if not exists public.policy_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.policy_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.policy_templates(id) on delete cascade,
  app_id      uuid not null references public.apps(id) on delete cascade,
  status      text not null check (status in ('allowed','blocked')),
  unique (template_id, app_id)
);
create index if not exists idx_policy_template_items_template
  on public.policy_template_items (template_id);

grant all on public.policy_templates      to service_role;
grant all on public.policy_template_items to service_role;
