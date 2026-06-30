import Breadcrumbs from '@/app/admin/Breadcrumbs'
import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { isOnline, offlineThresholdIso } from '@/lib/deviceStatus'
import EnrollmentPanel from './EnrollmentPanel'

const PAGE_SIZE = 25

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locId: string }>
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const { locId } = await params
  const { page: pageParam, status = 'all' } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: location } = await supabase.from('locations').select('id, name, org_id, enrollment_token').eq('id', locId).single()
  if (!location) notFound()
  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', location.org_id).single()

  const thresholdIso = offlineThresholdIso()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('devices')
    .select('device_id, hostname, os, last_seen', { count: 'exact' })
    .eq('location_id', locId)
    .order('last_seen', { ascending: false })
    .range(from, to)
  if (status === 'online') query = query.gte('last_seen', thresholdIso)
  else if (status === 'offline') query = query.or(`last_seen.is.null,last_seen.lt.${thresholdIso}`)

  const { data: devices, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filterLink = (s: string) => `/admin/locations/${locId}?status=${s}`
  const pageLink = (p: number) => `/admin/locations/${locId}?status=${status}&page=${p}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Clients', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        { label: location.name },
      ]} />
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Enroll devices</h2>
          <EnrollmentPanel locationId={location.id} initialToken={location.enrollment_token} />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-white">Devices</h2>
            <a href={`/admin/locations/${locId}/policies`} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
              Policies
            </a>
          </div>
          <div className="flex gap-1 text-sm">
            {(['all', 'online', 'offline'] as const).map(s => (
              <a
                key={s}
                href={filterLink(s)}
                className={`px-3 py-1.5 rounded-lg capitalize ${status === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {s}
              </a>
            ))}
          </div>
        </div>

        {devices && devices.length > 0 ? (
          <>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Device</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">OS</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => {
                    const online = isOnline(d.last_seen)
                    return (
                      <tr key={d.device_id} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <a href={`/admin/devices/${d.device_id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                            {d.hostname || 'Unknown device'}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{d.os}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? 'text-green-400' : 'text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
                            {online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{total} device{total === 1 ? '' : 's'} · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && <a href={pageLink(page - 1)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700">Previous</a>}
                {page < totalPages && <a href={pageLink(page + 1)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700">Next</a>}
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-500">No {status === 'all' ? '' : status} devices at this location.</p>
        )}
    </div>
  )
}
