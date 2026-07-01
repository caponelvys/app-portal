// Single source of truth for how a device name is displayed across the app.
// Device hostnames often carry a local domain suffix (e.g.
// "Elvys-MacBook-Pro-M3-Max.attlocal.net"); we show just the machine name.
// Returns '' for empty input so callers can apply their own fallback text.
export function cleanHostname(hostname: string | null | undefined): string {
  if (!hostname) return ''
  return hostname.split('.')[0] || hostname
}
