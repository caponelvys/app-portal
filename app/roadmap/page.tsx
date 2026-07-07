import type { Metadata } from 'next'
import BrandLockup from '../BrandLockup'

export const metadata: Metadata = {
  title: 'Roadmap — Ravyn',
  description: 'What Ravyn ships today and what we are building next — cross-platform application control for managed fleets.',
}

// The application-control loop — Ravyn's product thesis, in plain terms.
const LOOP = [
  { verb: 'Discover', line: 'Know every app across your fleet' },
  { verb: 'Decide', line: 'Set the policy that fits each client' },
  { verb: 'Enforce', line: 'Allow, block, install, remove — everywhere' },
  { verb: 'Respond', line: 'Users request, admins approve' },
  { verb: 'Report', line: 'Prove control with a full audit trail' },
]

const AVAILABLE = [
  { title: 'Cross-platform app control', body: 'Allow or block any application across macOS, Windows, and Linux endpoints.' },
  { title: 'Remote install & uninstall', body: 'Deploy or remove software across a device, a site, or the entire fleet — right from the portal.' },
  { title: 'Self-service access requests', body: 'Users request a blocked app; admins approve or deny in one click, with email notifications on every step.' },
  { title: 'Time-boxed access grants', body: 'Grant access for an hour, a day, or permanently. Expiry is automatic — no cleanup required.' },
  { title: 'Immutable audit trail', body: 'Every block, install, and approval is logged and exportable to CSV or PDF for client reporting.' },
  { title: 'Built for MSPs', body: 'True multi-tenant isolation per client, with role-based access for your technicians.' },
]

const UPCOMING: { phase: string; tone: 'now' | 'next' | 'later'; blurb: string; items: { title: string; body: string }[] }[] = [
  {
    phase: 'Now',
    tone: 'now',
    blurb: 'In active development.',
    items: [
      { title: 'Fleet software inventory', body: 'See exactly what is installed across every endpoint, with versions and publishers.' },
      { title: 'Learning mode', body: 'Let Ravyn observe for a couple of weeks and propose a baseline policy automatically — no hand-built allowlists.' },
      { title: 'Smarter policy rules', body: 'Allow by publisher, certificate, or hash, so a routine app update never breaks your rules.' },
    ],
  },
  {
    phase: 'Next',
    tone: 'next',
    blurb: 'Designed and queued.',
    items: [
      { title: 'Safe rollout rings', body: 'Promote a policy from test to pilot to production, so a change never hits the whole fleet at once.' },
      { title: 'Templates & rollback', body: 'Reusable policy templates, full version history, and one-click rollback.' },
      { title: 'Third-party patching', body: 'Spot outdated apps automatically and push updates through the agent you already run.' },
    ],
  },
  {
    phase: 'Later',
    tone: 'later',
    blurb: 'On the horizon.',
    items: [
      { title: 'Ringfencing', body: 'Control what an allowed app can touch — network, files, and other processes.' },
      { title: 'Elevation control', body: 'Run approved apps with admin rights without handing out local admin.' },
      { title: 'Removable storage control', body: 'Manage USB and external storage access per policy.' },
      { title: 'Compliance & integrations', body: 'SOC 2, HIPAA, and CJIS reporting; SIEM and syslog export; PSA integrations for Autotask and ConnectWise.' },
    ],
  },
]

const PHASE_PILL: Record<'now' | 'next' | 'later', string> = {
  now: 'bg-blue-600/20 text-blue-300 border border-blue-500/30',
  next: 'bg-gray-700/60 text-gray-300 border border-gray-600/50',
  later: 'bg-transparent text-gray-500 border border-gray-700',
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 px-4 py-4 backdrop-blur sm:px-6">
        <BrandLockup markSize={26} />
        <a href="/" className="whitespace-nowrap text-sm font-medium text-gray-400 hover:text-gray-200">
          Sign in
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Hero */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 font-[family-name:var(--font-mono-plex)] text-xs uppercase tracking-[0.18em] text-blue-400">
            <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-blue-600 shadow-[0_0_10px_1px_rgba(124,92,255,0.7)]" />
            Product Roadmap
          </span>
          <h1 className="mt-5 text-balance font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            Where Ravyn is headed
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-400">
            Ravyn gives managed IT teams complete control over the applications running across their fleet — on
            macOS, Windows, and Linux. Here is what is live today, and what we are building next.
          </p>
        </div>

        {/* The loop */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-mono-plex)] text-xs uppercase tracking-[0.14em] text-gray-500">
            The application-control loop
          </h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            {LOOP.map((s, i) => (
              <div key={s.verb} className="flex flex-1 items-stretch gap-3">
                <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                  <div className="font-[family-name:var(--font-mono-plex)] text-[11px] uppercase tracking-[0.12em] text-blue-400">
                    {s.verb}
                  </div>
                  <p className="mt-2 text-sm leading-snug text-gray-300">{s.line}</p>
                </div>
                {i < LOOP.length - 1 && (
                  <span aria-hidden="true" className="hidden self-center text-gray-600 sm:block">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Available now */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
              Available now
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-[family-name:var(--font-mono-plex)] text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live today
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AVAILABLE.map(f => (
              <div key={f.title} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Now / Next / Later */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
            What we are building
          </h2>
          <div className="mt-6 flex flex-col gap-4">
            {UPCOMING.map(group => (
              <div key={group.phase} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono-plex)] text-xs ${PHASE_PILL[group.tone]}`}>
                    {group.phase}
                  </span>
                  <span className="text-sm text-gray-500">{group.blurb}</span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map(item => (
                    <div key={item.title}>
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-400">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer / footer */}
        <footer className="mt-16 border-t border-gray-800 pt-6">
          <p className="text-sm text-gray-500">
            This roadmap reflects our current direction and priorities. It is not a delivery commitment, and plans
            may change as we learn from the teams who use Ravyn.
          </p>
          <div className="mt-4">
            <a href="/" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              Back to portal →
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
