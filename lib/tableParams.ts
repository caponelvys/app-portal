// Shared helpers for URL-driven, server-side table pagination/sort/filter.
//
// A page owns these query params: page (1-based), sort (column id),
// dir (asc|desc), and f_<colId>=value per active filter. The server page
// parses them to build the DB query (.range/.order/filters + count:'exact');
// ServerDataTable renders the current state and rewrites the URL on change.
// State is reconstructed purely from these params, so the client control needs
// no useSearchParams (no Suspense boundary) — it rebuilds the whole query string.

export const DEFAULT_PAGE_SIZE = 50

export type SortDir = 'asc' | 'desc'

export type TableState = {
  page: number
  sort: string | null
  dir: SortDir
  filters: Record<string, string>
}

type Raw = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

export function parseTableState(sp: Raw): TableState {
  const page = Math.max(1, parseInt(first(sp.page) ?? '1', 10) || 1)
  const sort = first(sp.sort) || null
  const dir: SortDir = first(sp.dir) === 'asc' ? 'asc' : 'desc'
  const filters: Record<string, string> = {}
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith('f_')) {
      const val = first(v)
      if (val != null && val !== '') filters[k.slice(2)] = val
    }
  }
  return { page, sort, dir, filters }
}

// Time-range filter values → age in ms; timeRangeSince → an ISO cutoff for
// a `.gte('<col>', ...)` server filter.
export const TIME_RANGE_MS: Record<string, number> = {
  '5m': 5 * 60e3, '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3,
}
export function timeRangeSince(v: string | undefined): string | null {
  if (!v || !(v in TIME_RANGE_MS)) return null
  return new Date(Date.now() - TIME_RANGE_MS[v]).toISOString()
}

export const TIME_RANGE_OPTIONS = [
  { label: 'Any time', value: '' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour', value: '1h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

type Changes = Partial<{
  page: number
  sort: string | null
  dir: SortDir
  filters: Record<string, string | null>
}>

// Pure URL builder — usable from both server (link hrefs) and client (router).
// Any filter/sort change resets to page 1 unless a page is given explicitly.
export function tableHref(basePath: string, state: TableState, changes: Changes = {}): string {
  const changingPage = changes.page !== undefined
  const page = changingPage ? changes.page! : 1
  const sort = changes.sort !== undefined ? changes.sort : state.sort
  const dir = changes.dir ?? state.dir
  const filters = { ...state.filters }
  if (changes.filters) {
    for (const [k, v] of Object.entries(changes.filters)) {
      if (v == null || v === '') delete filters[k]
      else filters[k] = v
    }
  }
  const p = new URLSearchParams()
  if (page > 1) p.set('page', String(page))
  if (sort) { p.set('sort', sort); p.set('dir', dir) }
  for (const [k, v] of Object.entries(filters)) p.set('f_' + k, v)
  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
