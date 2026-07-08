// Compliance mapping: relates Ravyn's immutable audit events to control families
// in common frameworks, so an MSP can show a client which controls the app-
// control activity evidences. Each control lists the audit event kinds that
// support it; the report sums the corresponding counts for a period.

export type AuditKind = 'request' | 'approved' | 'denied' | 'revoked' | 'accessed' | 'killed'

export const KIND_LABEL: Record<AuditKind, string> = {
  request: 'Access requests',
  approved: 'Access approvals',
  denied: 'Access denials',
  revoked: 'Access revocations',
  accessed: 'App-usage records',
  killed: 'Blocked-app enforcement',
}

export type Control = {
  id: string
  name: string
  description: string
  kinds: AuditKind[]
}

export type Framework = { id: string; name: string; blurb: string; controls: Control[] }

const ALL: AuditKind[] = ['request', 'approved', 'denied', 'revoked', 'accessed', 'killed']

export const FRAMEWORKS: Framework[] = [
  {
    id: 'soc2', name: 'SOC 2', blurb: 'Trust Services Criteria — Common Criteria',
    controls: [
      { id: 'CC6.1', name: 'Logical access — provisioning', description: 'Access to software is authorized, granted, modified, and revoked.', kinds: ['request', 'approved', 'denied', 'revoked'] },
      { id: 'CC6.8', name: 'Unauthorized software', description: 'The execution of unauthorized software is prevented and detected.', kinds: ['killed'] },
      { id: 'CC7.2', name: 'System monitoring', description: 'System components and activity are monitored and logged.', kinds: ALL },
      { id: 'CC7.3', name: 'Security event evaluation', description: 'Detected security events — blocks and access denials — are evaluated.', kinds: ['killed', 'denied'] },
    ],
  },
  {
    id: 'hipaa', name: 'HIPAA', blurb: 'Security Rule — 45 CFR §164',
    controls: [
      { id: '§164.308(a)(4)', name: 'Access management', description: 'Authorizing, establishing, and modifying access to systems.', kinds: ['request', 'approved', 'denied', 'revoked'] },
      { id: '§164.308(a)(5)', name: 'Malicious software', description: 'Procedures for guarding against and detecting malicious software.', kinds: ['killed'] },
      { id: '§164.312(b)', name: 'Audit controls', description: 'Recording and examining activity in systems that handle ePHI.', kinds: ALL },
      { id: '§164.308(a)(1)', name: 'Activity review', description: 'Regular review of records of information-system activity.', kinds: ['accessed', 'killed'] },
    ],
  },
  {
    id: 'cjis', name: 'CJIS', blurb: 'CJIS Security Policy v5',
    controls: [
      { id: '5.5', name: 'Access control', description: 'Least-privilege access to applications is enforced and recorded.', kinds: ['request', 'approved', 'denied', 'revoked'] },
      { id: '5.4', name: 'Auditing & accountability', description: 'Auditable events are generated, recorded, and retained.', kinds: ALL },
      { id: '5.10', name: 'System & information integrity', description: 'Execution of unauthorized software is blocked.', kinds: ['killed'] },
    ],
  },
]

export function frameworkById(id: string | undefined): Framework {
  return FRAMEWORKS.find(f => f.id === id) ?? FRAMEWORKS[0]
}
