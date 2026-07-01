type Day = { label: string; blocked: number; accessed: number }

// Stacked daily bars (accessed + blocked) for the last N days. Static SVG —
// no chart library, no client JS; hover tooltips via native <title>.
export default function ActivityChart({ days }: { days: Day[] }) {
  const W = 320, H = 132, padT = 8, padB = 20, padX = 4
  const chartH = H - padT - padB
  const max = Math.max(1, ...days.map(d => d.blocked + d.accessed))
  const n = days.length
  const slot = (W - padX * 2) / n
  const barW = Math.min(16, slot * 0.7)
  const total = days.reduce((s, d) => s + d.blocked + d.accessed, 0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f87171' }} />Blocked</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#60a5fa' }} />Accessed</span>
      </div>
      {total === 0 ? (
        <p className="text-gray-500 text-sm">No activity in the last 14 days.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="App activity over the last 14 days">
          {days.map((d, i) => {
            const x = padX + i * slot + (slot - barW) / 2
            const accH = (d.accessed / max) * chartH
            const blkH = (d.blocked / max) * chartH
            const yAcc = padT + chartH - accH
            const yBlk = yAcc - blkH
            return (
              <g key={i}>
                <title>{`${d.label}: ${d.blocked} blocked, ${d.accessed} accessed`}</title>
                {/* baseline hit area so empty days still show a tooltip */}
                <rect x={x} y={padT} width={barW} height={chartH} fill="transparent" />
                {d.accessed > 0 && <rect x={x} y={yAcc} width={barW} height={accH} fill="#60a5fa" rx="1" />}
                {d.blocked > 0 && <rect x={x} y={yBlk} width={barW} height={blkH} fill="#f87171" rx="1" />}
                {(i % 2 === 0 || i === n - 1) && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="#6b7280">{d.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
