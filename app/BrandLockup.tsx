import { useId, type CSSProperties } from 'react'

/**
 * Ravyn brand lockup — the glossy violet gradient diamond mark plus the "Ravyn"
 * wordmark. Use `wordmark={false}` for the mark on its own. The mark is the flat
 * (glow-free) variant so it stays crisp at nav/login sizes and matches the
 * favicon; don't recolor the gradient per the brand guide.
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
  // Unique gradient ids per instance — two lockups (desktop aside + mobile) share
  // the DOM; identical ids let a display:none instance's gradient win the url(#…)
  // lookup, leaving the visible mark unpainted.
  const uid = useId().replace(/:/g, '')
  const faceId = `rv-face-${uid}`
  const topId = `rv-top-${uid}`
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role={wordmark ? undefined : 'img'}
      aria-label={wordmark ? undefined : 'Ravyn'}
    >
      <svg width={markSize} height={markSize} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6b8bff" />
            <stop offset="0.55" stopColor="#7c5cff" />
            <stop offset="1" stopColor="#6d3fe0" />
          </linearGradient>
          <linearGradient id={topId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform="rotate(45 16 16)">
          <rect x="5" y="5" width="22" height="22" rx="5.5" fill={`url(#${faceId})`} />
          <rect x="5" y="5" width="22" height="11" rx="5.5" fill={`url(#${topId})`} />
        </g>
      </svg>
      {wordmark && (
        <span
          style={{ ...displayStyle, fontSize: markSize * 0.9, lineHeight: 1 }}
          className="font-semibold tracking-tight"
        >
          <span className="text-white">Rav</span>
          <span style={{ color: '#8b7bff' }}>yn</span>
        </span>
      )}
    </span>
  )
}
