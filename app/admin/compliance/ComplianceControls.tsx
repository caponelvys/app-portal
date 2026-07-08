type ControlView = {
  id: string
  name: string
  description: string
  evidence: number
  kinds: { label: string; count: number }[]
}

// Server component (no interactivity) — renders the mapped control families with
// their supporting audit-event counts. A control with evidence reads as covered.
export default function ComplianceControls({ controls }: { controls: ControlView[] }) {
  return (
    <div className="space-y-3">
      {controls.map(c => {
        const covered = c.evidence > 0
        return (
          <div key={c.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white">
                  <span className="font-mono text-xs text-gray-500 mr-2">{c.id}</span>
                  <span className="font-medium">{c.name}</span>
                </p>
                <p className="mt-0.5 text-sm text-gray-500">{c.description}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${
                covered
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-500'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${covered ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                {covered ? `${c.evidence.toLocaleString()} events` : 'No evidence yet'}
              </span>
            </div>
            {c.kinds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.kinds.map((k, i) => (
                  <span key={i} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {k.label} <span className="text-gray-500 tabular-nums">{k.count.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
