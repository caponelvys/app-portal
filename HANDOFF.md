# App Controller — Project Handoff

MSP web portal + cross-platform Python agent for controlling which apps run on
enrolled client devices. This doc is the single source of truth for a new
contributor/agent. Read `AGENTS.md` first (it warns this is a customized Next.js
16 — check `node_modules/next/dist/docs/` before using framework APIs).

## Stack & hosting
- **Frontend/portal:** Next.js 16 (App Router, Turbopack), React 19, Tailwind, TypeScript.
- **Backend:** Supabase (Postgres + Auth + REST/PostgREST). Project ref **`fdnqjwezvkcpwckyqmbg`** (`https://fdnqjwezvkcpwckyqmbg.supabase.co`).
- **Hosting:** Vercel — `https://appcontroller.vercel.app`. Auto-deploys on push to `main`.
- **Repo:** GitHub `caponelvys/app-portal`. Work on `main` (branch for PRs when appropriate).
- **Agent:** Python (`agent/agent.py`), runs as a root/SYSTEM service on macOS/Linux/Windows.
- **Email:** Resend (transactional), via `lib/email.ts` (REST, no SDK).

## Environment variables
Set in **Vercel** (Production + Preview) and locally in `.env.local` (git-ignored). Never commit values.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (also embedded in the agent for its REST calls)
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key (server-only; new-format `sb_secret_…`)
- `RESEND_API_KEY` — transactional email (Vercel only; if unset, emails are skipped silently)
- `EMAIL_FROM` — e.g. `App Portal <onboarding@resend.dev>` (sandbox only reaches the Resend account owner until a domain is verified)
- `NEXT_PUBLIC_APP_URL` — portal base URL for links in emails

## Supabase backend

### ⚠️ Live DB is AHEAD of `supabase/migrations/`
Several objects were applied directly in the SQL editor and are **not** in migration files. Treat the live DB as source of truth. Applied ad-hoc:
- `devices` columns: `agent_version`, `ip_address`, `device_user`, `pending_command`
- Table `agent_events` (+ `grant insert to anon`, `grant all to service_role`, RLS disabled)
- Fleet-wide grants fix: `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public TO service_role` + `ALTER DEFAULT PRIVILEGES … TO service_role`
- `GRANT ALL ON app_requests TO service_role`

Migration `0010_device_count_rpcs.sql` IS committed (the count RPCs).

### Tables (key columns)
- **orgs** `(id, name, created_at)`
- **locations** `(id, org_id, name, enrollment_token, created_at)` — `loc_…` token bakes into installers for zero-touch placement
- **memberships** `(user_id, org_id, …)` — msp_tech ↔ org scoping
- **profiles** `(id, email, role, role_v2, org_id, created_at)` — `role_v2`: `msp_admin | msp_tech | client_admin | client_user`; legacy `role`: `admin | user`
- **apps** `(id, name, description, url, icon, icon_url, process_name, status, …)` — `status` = global default policy (`allowed | blocked`)
- **app_policies** `(scope_type: org|location|device, scope_id, app_id, status)` — overrides; resolve device > location > org > global
- **app_requests** `(id, app_id, user_id, reason, duration, status, expires_at, reviewed_by, reviewed_at, created_at)` — per-user access grants
- **devices** `(id, device_id, hostname, os, last_seen, enrolled_at, user_id, pairing_code, location_id, org_id, agent_version, ip_address, device_user, pending_command)`
- **agent_logs** `(id, device_id, app_name, action, created_at)` — enforcement events; `action` = `killed`(blocked) | `accessed`
- **agent_events** `(id, device_id, level, event, message, created_at)` — agent lifecycle/ops: `started, enrolled, enroll_failed, paired, update_applied, update_failed, command_restart/update/uninstall, error`

### RPCs (migration 0010) — grouped counts, exact at any scale, `service_role`
`device_health_counts(org_ids uuid[])`, `device_version_counts(org_ids)`, `org_device_counts(org_ids)`, `location_device_counts(org_ids)`. `org_ids = NULL` → all orgs. Health tiers mirror `lib/deviceStatus.ts`.

### RLS / access model — important gotchas
- Most tables are effectively RLS-off; privileged writes go through **service-role** API routes gated by `lib/rbac.ts` (`getCallerProfile`, `isMspStaff`, `getAccessibleOrgIds`).
- **`app_requests` and `agent_events` MUST be read with the service-role client** (`createAdminClient()`), not the authenticated client — RLS/grants otherwise silently return empty/partial (this bit us: dashboard undercount, "permission denied for table", enroll 405 masked). See `lib/supabase-admin.ts`.
- The agent writes `agent_logs`/`agent_events`/heartbeats with the **anon** key directly; enrollment goes through `POST /api/enroll`.

## The agent (`agent/`, current **v1.5.0**)
Polls Supabase every 5s: heartbeat (`last_seen`, `agent_version`, `ip_address`, `device_user`), resolves effective blocked apps (policy inheritance + per-user grants), kills blocked processes, logs to `agent_logs`, emits lifecycle to `agent_events`.
- **Auto-update:** polls `GET /api/agent/version` (returns deployed `AGENT_VERSION`); if behind, downloads `agent.py`, validates (reject HTML, `py_compile`, version-match), backs up, replaces, re-execs. Can't brick itself.
- **Remote commands:** reads `devices.pending_command` each cycle — `restart` (re-exec), `update` (self-update), `uninstall` (remove service+files). Queued via `POST /api/devices/[deviceId]/command`. Cleared before running.
- **Enrollment:** installers bake the location token; `register_device` → `/api/enroll` (validates token server-side). `PORTAL_URL` (API base) is kept separate from `PAIRING_URL`.
- **Detects the logged-in OS user** (console user) → `device_user`; portal suggests a matching portal account as owner.

### ⚠️ Agent release workflow (do this on ANY agent change)
1. Bump `AGENT_VERSION` in **both** `agent/agent.py` and `lib/agentVersion.ts`
2. Add an entry to `agent/CHANGELOG.md` (+ the `AGENT_CHANGELOG` array in `lib/agentVersion.ts`)
3. Copy `agent/*` → `public/downloads/` (agent.py, install_*.sh/.bat, update_*) — **`public/downloads/` is what's served; keep it in sync with `agent/`**
4. Deploy. Existing agents (≥1.3.0) auto-update within ~5 min; older ones need one manual update.

## Portal feature inventory
- **Auth:** email/password + **TOTP 2FA** (mandatory for MSP staff) + Microsoft/Google **SSO** (invite-only guard in `/auth/callback`). Signup is invite-only. (SSO/MFA need provider config in the Supabase dashboard — see below.)
- **Dashboard** (`/admin`): stat cards, Agent Health tiers, Agent Versions (outdated), Needs Attention, Enforcement 24h, Top Blocked, Recent Activity, 14-day Activity chart, Orgs-not-enrolled, Quick Actions. Draggable widgets.
- **Organizations** (`/admin/orgs`, `/admin/orgs/[id]`): list + per-org insight dashboard (stats, health, activity, locations).
- **Locations** (`/admin/locations`, `/admin/locations/[id]`): fleet list + per-location enrollment panel (token, installer downloads with baked token, update command) + device table.
- **All Devices** (`/admin/devices`) + **device detail** (`/admin/devices/[id]`): identity (OS/user/owner/version/IP), Active access, Activity feed (merged events+enforcement), Download logs (CSV), owner auto-suggest, per-row ⋯ actions menu (open, policies, download logs, release owner, force update, restart, uninstall).
- **Monitor** (`/admin/monitor` = App Activity; `/admin/monitor/agents` = fleet Agent Monitor: version distribution, needs-attention, pending commands, filterable event stream).
- **Apps** (`/admin/apps`), **Policies** (org/location/device editors), **Requests** (`/admin/requests`: approve/deny/bulk, portal badge + staff emails on new request), **Reports** (`/admin/audit`: filterable, CSV export, PDF print at `/print/audit`), **Users** (`/admin/users`, invite, reset 2FA), **My Devices** (`/devices`, user-facing pairing), global ⌘K search.

## Conventions & mindset
- **Scale-first (assume thousands of devices):** summary-first pages; use `count`/grouped-RPCs instead of loading rows to tally; top-N previews + filter/search for detail; cap unbounded tables; bound lookup maps to referenced ids. Lean on ⌘K to jump to an agent.
- **Status vocabulary:** one system everywhere — health tiers (`Healthy/Inactive/Warning/Stale/Lost/Never`) from `lib/deviceStatus.ts`. "Healthy" = online.
- **Device name:** always render via `cleanHostname()` (`lib/hostname.ts`) — strips the local domain suffix.
- Shared helpers: `lib/agentVersion.ts` (version + `isVersionBehind`), `lib/agentEvents.ts` (event labels/colors), `lib/durations.ts`, `lib/deviceStatus.ts`.
- Verify UI changes against the running app; the app runs on port 3000 (`.claude/launch.json`).

## Pending / deferred
- **Email:** verify a real Resend sending domain (sandbox only reaches the owner address); **rotate the `RESEND_API_KEY`** (it was exposed in a screenshot).
- **Scale hardening (larger):** server-side pagination in `DataTable` (All Devices, Reports history, Agent events still load all matching rows client-side); add `org_id` to `agent_events` so org-scoping is an indexed filter instead of an `in(deviceIds)` list.
- **Provider config (dashboard, one-time):** enable TOTP + Azure + Google in Supabase Auth; keep "Link identities" ON. OAuth redirect URI: `https://fdnqjwezvkcpwckyqmbg.supabase.co/auth/v1/callback`.
- Increment 5: broader RLS pass (after RBAC).

## Run locally
`npm install` then `npm run dev` (port 3000). Needs `.env.local` with the three Supabase vars (email/app-url optional locally). `npx tsc --noEmit` to type-check; `npm run build` for a full build.
