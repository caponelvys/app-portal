// Shared labels/colors for agent_events (used by the device Activity panel,
// the log export, and the fleet Agent Monitor).
export const AGENT_EVENT_LABEL: Record<string, string> = {
  started:           'Agent started',
  enrolled:          'Enrolled into location',
  enroll_failed:     'Enrollment failed',
  paired:            'Paired to user',
  pairing:           'Awaiting user pairing',
  update_applied:    'Agent updated',
  update_failed:     'Agent update failed',
  command_restart:   'Restart command',
  command_update:    'Update command',
  command_uninstall: 'Uninstall command',
  error:             'Agent error',
}

export function agentEventLabel(event: string): string {
  return AGENT_EVENT_LABEL[event] ?? event
}

export const LEVEL_DOT: Record<string, string> = {
  info:  'bg-gray-500',
  warn:  'bg-orange-400',
  error: 'bg-red-500',
}
