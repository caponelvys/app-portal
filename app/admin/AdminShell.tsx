'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import GlobalSearch from './GlobalSearch'
import BrandLockup from '../BrandLockup'

const PRIMARY_NAV = [
  { label: 'Dashboard',     href: '/admin', exact: true },
  { label: 'Organizations', href: '/admin/orgs' },
  { label: 'Monitor',       href: '/admin/monitor' },
  { label: 'Apps',          href: '/admin/apps' },
  { label: 'Requests',      href: '/admin/requests' },
  { label: 'Reports',       href: '/admin/audit' },
]

const SIDEBARS: Record<string, { title: string; items: { label: string; href: string }[] }> = {
  '/admin/apps': { title: 'Apps', items: [
    { label: 'All Apps', href: '/admin/apps' },
    { label: 'Add App',  href: '/admin/new' },
  ]},
  '/admin/new': { title: 'Apps', items: [
    { label: 'All Apps', href: '/admin/apps' },
    { label: 'Add App',  href: '/admin/new' },
  ]},
  '/admin/edit': { title: 'Apps', items: [
    { label: 'All Apps', href: '/admin/apps' },
    { label: 'Add App',  href: '/admin/new' },
  ]},
  '/admin/monitor': { title: 'Monitor', items: [
    { label: 'App Activity', href: '/admin/monitor' },
    { label: 'Agents',       href: '/admin/monitor/agents' },
    { label: 'Software',     href: '/admin/monitor/software' },
    { label: 'Policy Rules', href: '/admin/monitor/rules' },
    { label: 'Policy Templates', href: '/admin/monitor/templates' },
    { label: 'Policy History', href: '/admin/monitor/policy-history' },
  ]},
  '/admin/orgs': { title: 'Organizations', items: [
    { label: 'Organizations', href: '/admin/orgs' },
    { label: 'Locations',     href: '/admin/locations' },
    { label: 'All Devices',   href: '/admin/devices' },
  ]},
  '/admin/locations': { title: 'Organizations', items: [
    { label: 'Organizations', href: '/admin/orgs' },
    { label: 'Locations',     href: '/admin/locations' },
    { label: 'All Devices',   href: '/admin/devices' },
  ]},
  '/admin/devices': { title: 'Organizations', items: [
    { label: 'Organizations', href: '/admin/orgs' },
    { label: 'Locations',     href: '/admin/locations' },
    { label: 'All Devices',   href: '/admin/devices' },
  ]},
  '/admin/requests': { title: 'Requests', items: [
    { label: 'Access Requests', href: '/admin/requests' },
  ]},
  '/admin/audit': { title: 'Reports', items: [
    { label: 'Activity Report', href: '/admin/audit' },
    { label: 'Compliance', href: '/admin/compliance' },
  ]},
  '/admin/compliance': { title: 'Reports', items: [
    { label: 'Activity Report', href: '/admin/audit' },
    { label: 'Compliance', href: '/admin/compliance' },
  ]},
  '/admin/users': { title: 'Users', items: [
    { label: 'All Users',   href: '/admin/users' },
    { label: 'Invite User', href: '/admin/users/invite' },
  ]},
}

function getSidebar(pathname: string) {
  const keys = Object.keys(SIDEBARS).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(key + '/') || pathname.startsWith(key + '?')) {
      return SIDEBARS[key]
    }
  }
  return null
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function isNavActive(href: string, exact: boolean | undefined, pathname: string) {
  if (exact) return pathname === href
  // strip query from href for prefix check
  const base = href.split('?')[0]
  return pathname.startsWith(base)
}

// The active sidebar item is the one whose href is the longest match for the
// current path, so e.g. /admin/monitor/agents highlights "Agents", not the
// "/admin/monitor" parent.
function activeSidebarHref(items: { href: string }[], pathname: string): string | null {
  let best: string | null = null
  for (const it of items) {
    const base = it.href.split('?')[0]
    if (pathname === base || pathname.startsWith(base + '/')) {
      if (!best || base.length > best.length) best = it.href
    }
  }
  return best
}

export default function AdminShell({ children, roleLabel }: { children: React.ReactNode; roleLabel: string }) {
  const pathname = usePathname()
  const sidebar = getSidebar(pathname)
  const activeSidebar = sidebar ? activeSidebarHref(sidebar.items, pathname) : null
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Poll the pending-request count for the nav badge. Refreshes on mount,
  // on navigation (e.g. after approving), and every 45s.
  useEffect(() => {
    let active = true
    const load = () =>
      fetch('/api/app-requests/pending-count')
        .then(r => r.json())
        .then(d => { if (active) setPendingCount(d.count ?? 0) })
        .catch(() => {})
    load()
    const t = setInterval(load, 45_000)
    return () => { active = false; clearInterval(t) }
  }, [pathname])

  const ROLE_LABELS: Record<string, string> = {
    msp_admin: 'Admin', msp_tech: 'Tech', client_admin: 'Org Admin', client_user: 'Org Tech',
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* ── Top Nav (floating card) ── */}
      <nav className="fixed top-0 inset-x-0 z-50 px-3 pb-3">
        <div className="mx-auto flex h-14 items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/80 backdrop-blur px-4">
        {/* Logo */}
        <Link href="/admin" className="flex items-center shrink-0 mr-1">
          <BrandLockup markSize={24} />
        </Link>

        {/* Primary nav — desktop */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {PRIMARY_NAV.map(item => {
            const active = isNavActive(item.href, item.exact, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center ${
                  active
                    ? 'bg-blue-600/15 text-blue-300'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
                {item.href === '/admin/requests' && <NavBadge count={pendingCount} />}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <GlobalSearch />
          <span className="hidden sm:inline text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-1 rounded-md">
            {ROLE_LABELS[roleLabel] ?? roleLabel}
          </span>
          <Link
            href="/admin/users"
            className="hidden sm:inline text-xs text-gray-400 hover:text-white transition-colors"
          >
            Users
          </Link>
          <a href="/" className="hidden sm:inline text-xs text-gray-400 hover:text-white transition-colors">
            My apps
          </a>
          <a href="/account/security" className="hidden sm:inline text-xs text-gray-400 hover:text-white transition-colors">
            Security
          </a>
          <a href="/auth/signout" className="text-xs text-gray-400 hover:text-white transition-colors">
            Sign out
          </a>
          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-400 hover:text-white p-2 -mr-2 rounded-md"
            onClick={() => setMobileOpen(o => !o)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-20 bg-gray-900 md:hidden overflow-y-auto">
          <div className="p-4 flex flex-col gap-1">
            {PRIMARY_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors inline-flex items-center ${
                  isNavActive(item.href, item.exact, pathname)
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
                {item.href === '/admin/requests' && <NavBadge count={pendingCount} />}
              </Link>
            ))}

            {/* Current section sub-items */}
            {sidebar && sidebar.items.length > 0 && (
              <div className="border-t border-gray-800 mt-2 pt-2">
                <p className="px-4 py-1 text-xs text-gray-500 uppercase tracking-wider font-medium">{sidebar.title}</p>
                {sidebar.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-3 rounded-md text-sm transition-colors ${
                      item.href === activeSidebar
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-gray-800 mt-2 pt-2">
              <Link href="/admin/users" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800">Users</Link>
              <a href="/" className="block px-4 py-3 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800">My apps</a>
              <a href="/auth/signout" className="block px-4 py-3 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-800">Sign out</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 pt-20">
        {/* Sidebar */}
        {sidebar && (
          <aside className="hidden md:flex flex-col fixed top-20 left-0 bottom-0 w-52 bg-gray-900 border-r border-gray-800 overflow-y-auto z-30">
            <div className="px-3 pt-5 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                {sidebar.title}
              </p>
              <nav className="flex flex-col gap-0.5">
                {sidebar.items.map(item => {
                  const active = item.href === activeSidebar
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto min-h-[calc(100vh-5rem)] ${sidebar ? 'md:ml-52' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
