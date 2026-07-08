# PSA integration (Autotask / ConnectWise) — design note

**Status:** Not built natively. The generic **webhook export** (Reports →
Integrations) is the supported integration surface today; native PSA connectors
are a separate, credentialed effort documented here.

## What ships today

Signed outbound webhooks (`lib/webhooks.ts`): audit events are POSTed to a
configured HTTPS endpoint, HMAC-SHA256 signed (`X-Ravyn-Signature`). Any system
that can receive an HTTP webhook — a SIEM, an iPaaS (Zapier/Make/n8n), or a PSA's
inbound automation — can consume this. For many MSPs, routing the webhook through
an automation platform into Autotask/ConnectWise is sufficient and needs no
Ravyn-side PSA code.

## What native PSA connectors would add

Direct ticket/config sync against each PSA's API:

- **ConnectWise Manage** — REST API (`/service/tickets`, `/company/configurations`);
  auth via a public/private API key pair + clientId. Create/update tickets on
  events (e.g. a blocked app or a failed install), map devices to Configurations.
- **Autotask (Datto) PSA** — REST API (`/Tickets`, `/ConfigurationItems`); auth via
  an API-user username/secret + integration code. Same shape: tickets + CI sync.

Each requires:

- **Per-tenant credentials** stored securely (a `psa_connections` table:
  provider, base URL, encrypted secrets, org mapping).
- **Field mapping** — Ravyn org → PSA company, device → configuration item, event
  kind → ticket type/board/priority.
- **Rate-limit & retry handling**, and de-duplication (don't open a ticket per
  identical event).
- **Testing against a real PSA sandbox** — can't be built or validated without
  live credentials.

## Recommended path

1. Now: webhook → iPaaS → PSA for teams that need it (no Ravyn code).
2. Later, if demand justifies it: build a `psa_connections` model + one connector
   at a time (ConnectWise first — larger MSP install base), starting from a
   sandbox account.
