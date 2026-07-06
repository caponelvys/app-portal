import { NextResponse } from 'next/server'
import { AGENT_VERSION, COMPANION_VERSION } from '@/lib/agentVersion'

// Public endpoint the agent polls to learn the latest published versions.
// "Latest" is simply the deployed AGENT_VERSION / COMPANION_VERSION (single source
// of truth); when they're bumped and deployed, agents converge — self-updating the
// agent and re-installing the companion for the logged-in user.
export async function GET() {
  return NextResponse.json(
    { version: AGENT_VERSION, companion_version: COMPANION_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
