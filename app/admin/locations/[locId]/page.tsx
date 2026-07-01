import Breadcrumbs from '@/app/admin/Breadcrumbs'
import RenameForm from '@/app/admin/RenameForm'
import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import EnrollmentPanel from './EnrollmentPanel'
import DevicesTable from './DevicesTable'

const PAGE_SIZE = 25

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locId: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { locId } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: location } = await supabase.from('locations').select('id, name, org_id, enrollment_token').eq('id', locId).single()
  if (!location) notFound()
  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', location.org_id).single()

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: devices, count } = await supabase
    .from('devices')
    .select('device_id, hostname, os, last_seen, agent_version', { count: 'exact' })
    .eq('location_id', locId)
    .order('last_seen', { ascending: false })
    .range(from, to)
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const pageLink = (p: number) => `/admin/locations/${locId}?page=${p}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Organizations', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        { label: location.name },
      ]} />
        <div className="mb-6">
          <RenameForm kind="location" id={location.id} currentName={location.name} />
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Enroll devices</h2>
          <EnrollmentPanel locationId={location.id} initialToken={location.enrollment_token} />
        </section>

        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold text-white">Devices</h2>
          <a href={`/admin/locations/${locId}/policies`} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
            Policies
          </a>
        </div>

        <DevicesTable devices={devices ?? []} userId={user.id} />
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>{total} device{total === 1 ? '' : 's'} · page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <a href={pageLink(page - 1)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700">Previous</a>}
              {page < totalPages && <a href={pageLink(page + 1)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700">Next</a>}
            </div>
          </div>
        )}
    </div>
  )
}
