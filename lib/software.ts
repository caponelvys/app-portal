// Display helpers for reported software inventory.
//
// The agent stores the raw macOS codesign authority (kept faithful), which
// carries a trailing 10-char Apple Team ID — e.g. "AppHouseKitchen GmbH
// (3WVC84GB99)" — and, for Mac App Store / system apps, a generic Apple signing
// authority that isn't the real vendor. We tidy both only at render time.

// Authorities that identify Apple's signing infrastructure rather than the app's
// actual publisher — not useful to show, so they render as no publisher.
const GENERIC_SIGNERS = new Set([
  'Apple Mac OS Application Signing',
  'Software Signing',
])

/** Publisher fit for display: drops the Apple Team ID suffix and generic Apple
 *  signing authorities. Returns null when nothing useful remains. */
export function cleanPublisher(publisher: string | null | undefined): string | null {
  if (!publisher) return null
  const stripped = publisher.replace(/\s*\([A-Z0-9]{10}\)\s*$/, '').trim()
  if (!stripped || GENERIC_SIGNERS.has(stripped)) return null
  return stripped
}
