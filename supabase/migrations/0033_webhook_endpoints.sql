-- Reporting & integration: outbound webhook export. Audit events (from the
-- immutable audit_timeline) are forwarded to configured HTTPS endpoints, signed
-- with an HMAC-SHA256 of the body (X-Ravyn-Signature) so the receiver can verify
-- authenticity. A per-endpoint cursor tracks the last-forwarded event time; a
-- scheduled flush advances it. This is the generic integration surface a SIEM or
-- PSA (Autotask/ConnectWise) can consume; native PSA connectors are a separate
-- credentialed effort. Portal-only (service-role).

create table if not exists public.webhook_endpoints (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references public.orgs(id) on delete cascade,  -- null = all orgs (msp_admin)
  url               text not null,
  secret            text not null,                    -- HMAC signing secret
  enabled           boolean not null default true,
  cursor            timestamptz not null default now(),  -- last forwarded event time
  last_status       text,                             -- last delivery outcome
  last_delivered_at timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
create index if not exists idx_webhook_endpoints_org on public.webhook_endpoints (org_id);

grant all on public.webhook_endpoints to service_role;
