-- M2 CP4: allow policy_rules to match on an executable's sha256 (build hash),
-- alongside publisher/path/name. The agent reports the main executable's sha256
-- (v1.7.20), so a hash rule targets a specific build.
--
-- Note on granularity: enforcement is by process name, so materializing a hash
-- BLOCK rule blocks the matched app (all builds), not just the one build —
-- per-build selective enforcement would need the agent to hash running
-- processes at kill time. Hash matching here is for identifying/acting on the
-- app that carries a given build.

alter table public.policy_rules drop constraint if exists policy_rules_match_type_check;
alter table public.policy_rules add  constraint policy_rules_match_type_check
  check (match_type in ('publisher','path','name','hash'));
