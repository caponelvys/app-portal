import type { Metadata } from 'next'
import BrandLockup, { RavynWord } from '../BrandLockup'

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
  { title: 'Fleet software inventory', body: 'See exactly what is installed across every endpoint — with versions, publishers, and build hashes.' },
  { title: 'Learning mode', body: 'Let Ravyn observe first and propose a baseline policy, instead of hand-building allowlists.' },
  { title: 'Smarter policy rules', body: 'Allow or block by publisher, path, name, or exact build hash — so a routine update never breaks a rule.' },
  { title: 'Safe rollout rings', body: 'Stage a policy from test to pilot to production, so a bad push never hits the whole fleet at once.' },
  { title: 'Templates, history & rollback', body: 'Reusable policy templates, a full change history, and one-click rollback.' },
  { title: 'Remote install & uninstall', body: 'Deploy or remove software across a device, a site, or the entire fleet from the portal.' },
  { title: 'Elevation control', body: 'Run approved apps with admin rights without granting the user local admin.' },
  { title: 'USB & removable storage', body: 'Block or allow removable storage per organization, location, ring, or device.' },
  { title: 'Self-service access requests', body: 'Users request a blocked app; admins approve or deny in a click, with time-boxed grants that expire automatically.' },
  { title: 'Compliance reporting', body: 'SOC 2, HIPAA, and CJIS control mapping over an immutable audit trail — exportable to CSV and PDF.' },
  { title: 'Integrations & metering', body: 'Stream audit events to your SIEM or PSA via signed webhooks, with per-endpoint usage tracking for billing.' },
]

// Genuinely still ahead — most of the original roadmap has shipped.
const HORIZON = [
  { title: 'Third-party patching', body: 'Detect outdated apps from inventory and push updates through the agent you already run.' },
  { title: 'Ringfencing', body: 'Control what an allowed app can touch — network, files, registry, and other processes.' },
  { title: 'Native PSA sync', body: 'Direct ticket and asset sync with Autotask and ConnectWise, beyond today’s webhook export.' },
]

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
            Where <RavynWord /> is headed
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-400">
            Ravyn gives managed IT teams complete, multi-tenant control over the applications running across their
            fleet — on macOS, Windows, and Linux. The full discover → decide → enforce → respond → report loop is
            live today. Here is everything that ships now, and the few things still ahead.
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

        {/* On the horizon */}
        <section className="mt-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
            On the horizon
          </h2>
          <p className="mt-2 text-sm text-gray-500">The few capabilities still ahead.</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HORIZON.map(item => (
              <div key={item.title} className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-5">
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{item.body}</p>
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <a href="/" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              Back to portal →
            </a>
            <p className="font-[family-name:var(--font-mono-plex)] text-xs text-gray-600">
              Designed &amp; built by{' '}
              <span className="font-[family-name:var(--font-display)] font-semibold">
                <span className="text-white">Elv</span><span style={{ color: '#8b7bff' }}>ys</span>
              </span>
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
