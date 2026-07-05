'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Idle window. Kept in sync with IDLE_MS enforced server-side in proxy.ts.
const IDLE_MS = 30 * 60 * 1000
// How long before the idle deadline the "still there?" warning appears.
const WARNING_MS = 60 * 1000
// The cookie must outlive the idle window so the timestamp is still readable
// by the proxy after the user goes idle (that's how the server bounces a stale
// tab even when this component's JS never ran).
const COOKIE_MAX_AGE = 12 * 60 * 60
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove']

/**
 * Client half of the session timeout. Drives activity off genuine user input
 * (never HTTP requests — background polling like AdminShell's 45s refresh must
 * not count as activity), records it in the `lastActivity` cookie for the proxy
 * to read, and — a minute before the idle deadline — shows a warning so the user
 * can stay signed in. If ignored, it signs out so sensitive data doesn't stay on
 * screen at an unattended desk. The proxy is the real gate.
 */
export default function SessionTimeout() {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.round(WARNING_MS / 1000))
  // The button handlers live inside the effect (they close over the timers);
  // expose them to the rendered modal through refs.
  const stayRef = useRef<() => void>(() => {})

  useEffect(() => {
    let warnTimer: ReturnType<typeof setTimeout> | undefined
    let logoutTimer: ReturnType<typeof setTimeout> | undefined
    let countdown: ReturnType<typeof setInterval> | undefined
    let lastWrite = 0
    let armed = false
    let warningActive = false

    const writeActivity = () => {
      const secure = location.protocol === 'https:' ? '; secure' : ''
      document.cookie = `lastActivity=${Date.now()}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${secure}`
    }

    const clearTimers = () => {
      if (warnTimer) clearTimeout(warnTimer)
      if (logoutTimer) clearTimeout(logoutTimer)
      if (countdown) clearInterval(countdown)
    }

    const logout = async () => {
      clearTimers()
      try { await supabase.auth.signOut() } catch {}
      window.location.href = '/login?timeout=idle'
    }

    const showWarning = () => {
      warningActive = true
      setWarning(true)
      const deadline = Date.now() + WARNING_MS
      setSecondsLeft(Math.round(WARNING_MS / 1000))
      countdown = setInterval(() => {
        setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
      }, 250)
    }

    const schedule = () => {
      if (warnTimer) clearTimeout(warnTimer)
      if (logoutTimer) clearTimeout(logoutTimer)
      warnTimer = setTimeout(showWarning, IDLE_MS - WARNING_MS)
      logoutTimer = setTimeout(logout, IDLE_MS)
    }

    // User explicitly chose to stay signed in — clear the warning and restart.
    const stay = () => {
      if (countdown) clearInterval(countdown)
      warningActive = false
      setWarning(false)
      lastWrite = Date.now()
      writeActivity()
      schedule()
    }
    stayRef.current = stay

    const onActivity = () => {
      // Once the warning is up, passive activity must not silently keep the
      // session alive — the user has to make an explicit choice.
      if (warningActive) return
      const now = Date.now()
      if (now - lastWrite > 15_000) {
        lastWrite = now
        writeActivity()
      }
      schedule()
    }

    const arm = () => {
      if (armed) return
      armed = true
      ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
      lastWrite = Date.now()
      writeActivity()
      schedule()
    }

    const disarm = () => {
      armed = false
      warningActive = false
      setWarning(false)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity))
      clearTimers()
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

  if (!warning) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
        <h2 id="session-timeout-title" className="text-lg font-bold text-white">
          Still there?
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          You&apos;ll be signed out in{' '}
          <span className="font-semibold text-white tabular-nums">{secondsLeft}</span>{' '}
          second{secondsLeft === 1 ? '' : 's'} due to inactivity.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => stayRef.current()}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Stay signed in
          </button>
          <a
            href="/auth/signout"
            className="rounded-lg border border-gray-700 px-4 py-2 text-center text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  )
}
