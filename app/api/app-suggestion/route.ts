import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

// A user suggests an app that isn't in the catalog yet ("Can't find it?"). Emails
// MSP staff so they can add + policy it. No new table — it's a lightweight nudge.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, reason } = await req.json().catch(() => ({}))
  const appName = (name ?? '').toString().trim().slice(0, 120)
  if (!appName) return NextResponse.json({ error: 'App name is required' }, { status: 400 })
  const cleanReason = (reason ?? '').toString().trim().slice(0, 1000)

  const admin = createAdminClient()
  try {
    const [{ data: staff }, { data: me }] = await Promise.all([
      admin.from('profiles').select('email, role, role_v2').or('role.eq.admin,role_v2.in.(msp_admin,msp_tech)'),
      admin.from('profiles').select('email').eq('id', user.id).single(),
    ])
    const recipients = [...new Set((staff ?? []).map(s => s.email).filter(Boolean))] as string[]
    if (recipients.length) {
      await sendEmail({
        to: recipients,
        subject: `App suggestion: ${appName}`,
        html:
          `<p><strong>${escapeHtml(me?.email ?? 'A user')}</strong> suggested adding ` +
          `<strong>${escapeHtml(appName)}</strong> to the catalog.</p>` +
          (cleanReason ? `<p>${escapeHtml(cleanReason)}</p>` : ''),
      })
    }
  } catch (e) {
    console.error('[app-suggestion] notify failed', e)
  }

  return NextResponse.json({ success: true })
}
