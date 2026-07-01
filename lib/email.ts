import { durationLabel, expiresInLabel } from './durations'

// Transactional email via Resend's REST API (no SDK dependency).
// Configure with env vars:
//   RESEND_API_KEY   - required to actually send; if unset, sends are skipped
//   EMAIL_FROM       - e.g. "App Portal <noreply@yourdomain.com>"
//   NEXT_PUBLIC_APP_URL - portal base URL used in email links
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://appcontroller.vercel.app'

type SendArgs = { to: string | string[]; subject: string; html: string }

// Returns true if the email was sent, false if skipped or failed.
export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  if (Array.isArray(to) && to.length === 0) return false
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'App Portal <onboarding@resend.dev>'

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] send failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] send error', e)
    return false
  }
}

function layout(
  title: string,
  body: string,
  opts: { ctaPath?: string; ctaLabel?: string; footer?: string } = {},
): string {
  const href = `${APP_URL}${opts.ctaPath ?? ''}`
  const ctaLabel = opts.ctaLabel ?? 'Open App Portal'
  const footer = opts.footer ?? "You're receiving this because you requested app access in the App Portal."
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 16px">${title}</h2>
    ${body}
    <p style="margin-top:24px">
      <a href="${href}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">${ctaLabel}</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:24px">${footer}</p>
  </div>`
}

// Notify MSP staff (admins + techs) that a user submitted a new access request.
export async function sendAccessRequestedEmail(args: {
  to: string[]
  appName: string
  requesterEmail: string
  duration: string
  reason: string | null
}): Promise<boolean> {
  const { to, appName, requesterEmail, duration, reason } = args
  return sendEmail({
    to,
    subject: `New access request: ${appName}`,
    html: layout(
      `New access request`,
      `<p><strong>${requesterEmail}</strong> is requesting access to <strong>${appName}</strong> (${durationLabel(duration).toLowerCase()}).</p>
       ${reason ? `<p style="color:#444">Reason: <em>&ldquo;${reason}&rdquo;</em></p>` : ''}
       <p>Review it in the portal to approve or deny.</p>`,
      {
        ctaPath: '/admin/requests',
        ctaLabel: 'Review request',
        footer: "You're receiving this because you're an administrator in the App Portal.",
      },
    ),
  })
}

// Notify a requester that their app-access request was approved or denied.
export async function sendAccessDecisionEmail(args: {
  to: string
  appName: string
  approved: boolean
  duration: string
  expiresAt: string | null
}): Promise<boolean> {
  const { to, appName, approved, duration, expiresAt } = args

  if (approved) {
    const window = expiresAt
      ? `Your access is active now and will expire in ${expiresInLabel(expiresAt)}.`
      : 'Your access is active now and does not expire.'
    return sendEmail({
      to,
      subject: `Access approved: ${appName}`,
      html: layout(
        `✅ Access approved`,
        `<p>Your request for <strong>${appName}</strong> (${durationLabel(duration).toLowerCase()}) has been approved.</p>
         <p>${window}</p>`,
      ),
    })
  }

  return sendEmail({
    to,
    subject: `Access request declined: ${appName}`,
    html: layout(
      `Access request declined`,
      `<p>Your request for <strong>${appName}</strong> was not approved.</p>
       <p>If you think this was a mistake, reach out to your administrator.</p>`,
    ),
  })
}

// Notify a user that an active grant was revoked early by an admin.
export async function sendAccessRevokedEmail(args: { to: string; appName: string }): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `Access revoked: ${args.appName}`,
    html: layout(
      `Access revoked`,
      `<p>Your access to <strong>${args.appName}</strong> has been revoked by an administrator and is no longer active.</p>
       <p>If you still need it, you can submit a new request from the portal.</p>`,
    ),
  })
}
