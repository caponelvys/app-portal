import { NextResponse } from 'next/server'
import { AGENT_VERSION } from '@/lib/agentVersion'

// Public endpoint the agent polls to learn the latest published version.
// "Latest" is simply the deployed AGENT_VERSION (single source of truth); when
// it's bumped and deployed, agents on older versions self-update to match.
export async function GET() {
  return NextResponse.json(
    { version: AGENT_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
