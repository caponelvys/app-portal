export type PolicyStatus = 'allowed' | 'blocked'
export type ScopeType = 'org' | 'location' | 'device'

// An app row prepared for the policy editor at a given scope.
export type PolicyApp = {
  id: string
  name: string
  icon_url: string | null
  inherited: PolicyStatus       // what this app resolves to from parent scopes
  override: PolicyStatus | null // policy set at THIS scope (null = inheriting)
}

// Build an app_id -> status map from raw policy rows.
export function toStatusMap(rows: { app_id: string; status: string }[] | null): Map<string, PolicyStatus> {
  return new Map((rows ?? []).map(r => [r.app_id, r.status as PolicyStatus]))
}

// Resolve effective status, most-specific override first, falling back to the
// app's global default. Pass only the maps relevant to the scope chain.
export function resolveStatus(
  appId: string,
  globalDefault: PolicyStatus,
  maps: { org?: Map<string, PolicyStatus>; location?: Map<string, PolicyStatus>; device?: Map<string, PolicyStatus> },
): PolicyStatus {
  return (
    maps.device?.get(appId) ??
    maps.location?.get(appId) ??
    maps.org?.get(appId) ??
    globalDefault
  )
}
