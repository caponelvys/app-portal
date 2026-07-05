import type { CSSProperties } from 'react'

/**
 * Corvex brand lockup — the faceted violet mark plus the "Corvex" wordmark.
 * Use `wordmark={false}` for the mark on its own. Colors are the fixed brand
 * facets (do not recolor per the brand guide).
 */
export default function BrandLockup({
  className = '',
  markSize = 28,
  wordmark = true,
}: {
  className?: string
  markSize?: number
  wordmark?: boolean
}) {
  const displayStyle: CSSProperties = { fontFamily: 'var(--font-display)' }
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role={wordmark ? undefined : 'img'}
      aria-label={wordmark ? undefined : 'Corvex'}
    >
      <svg width={markSize} height={markSize} viewBox="0 0 48 48" aria-hidden="true">
        <polygon points="24,5 24,24 5,24" fill="#7C5CFF" />
        <polygon points="24,5 43,24 24,24" fill="#5B3FF0" />
        <polygon points="24,24 43,24 24,43" fill="#7C5CFF" />
        <polygon points="24,24 5,24 24,43" fill="#5B3FF0" />
      </svg>
      {wordmark && (
        <span style={displayStyle} className="text-xl font-semibold tracking-tight text-white">
          Corvex
        </span>
      )}
    </span>
  )
}
