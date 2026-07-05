'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Idle window. Kept in sync with IDLE_MS enforced server-side in proxy.ts.
const IDLE_MS = 30 * 60 * 1000
// The cookie must outlive the idle window so the timestamp is still readable
// by the proxy after the user goes idle (that's how the server bounces a stale
// tab even when this component's JS never ran).
const COOKIE_MAX_AGE = 12 * 60 * 60
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove']

/**
 * Client half of the session timeout. Drives activity off genuine user input
 * (never HTTP requests — background polling like AdminShell's 45s refresh must
 * not count as activity), records it in the `lastActivity` cookie for the proxy
 * to read, and proactively signs the user out after IDLE_MS so sensitive data
 * doesn't stay on screen at an unattended desk. The proxy is the real gate.
 */
export default function SessionTimeout() {
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    let lastWrite = 0
    let armed = false

    const writeActivity = () => {
      const secure = location.protocol === 'https:' ? '; secure' : ''
      document.cookie = `lastActivity=${Date.now()}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${secure}`
    }

    const logout = async () => {
      try { await supabase.auth.signOut() } catch {}
      window.location.href = '/login?timeout=idle'
    }

    const onActivity = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(logout, IDLE_MS)
      // Throttle cookie writes to at most once every 15s.
      const now = Date.now()
      if (now - lastWrite > 15_000) {
        lastWrite = now
        writeActivity()
      }
    }

    const arm = () => {
      if (armed) return
      armed = true
      ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
      lastWrite = Date.now()
      writeActivity()
      idleTimer = setTimeout(logout, IDLE_MS)
    }

    const disarm = () => {
      armed = false
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity))
      if (idleTimer) clearTimeout(idleTimer)
    }

    // Only run for signed-in users; getSession() reads the local cookie (no network).
    supabase.auth.getSession().then(({ data }) => { if (data.session) arm() })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) arm()
      else disarm()
    })

    return () => {
      sub.subscription.unsubscribe()
      disarm()
    }
  }, [])

  return null
}
