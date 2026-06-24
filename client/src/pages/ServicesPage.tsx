import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import StepsPanel from '../components/StepsPanel'
import CopyButton from '../components/CopyButton'

interface ServiceItem {
  id: number
  name: string | null
  _count: { steps: number; clients: number }
}

export default function ServicesPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: services = [], isLoading, isError } = useQuery<ServiceItem[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch<ServiceItem[]>('/api/services'),
  })

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-gray-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-4 page-enter
                       md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden">

        <div className="mb-4 md:shrink-0">
          <h2 className="text-xl font-bold text-gray-900">الخطوات</h2>
          <p className="text-sm text-gray-500 mt-0.5">إدارة خدمات المكتب وخطواتها</p>
        </div>

        {isError && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل الخدمات، حاول تحديث الصفحة.
          </div>
        )}

        <div className="md:flex md:flex-col md:flex-1 md:min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">الخدمة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center w-24">الخطوات</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center w-24">العملاء</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-4 py-2.5">
                          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="h-6 w-7 bg-gray-100 rounded-full animate-pulse mx-auto" />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="h-6 w-7 bg-gray-100 rounded-full animate-pulse mx-auto" />
                        </td>
                        <td />
                      </tr>
                    ))
                  : services.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <p className="text-gray-500 font-medium">لا توجد خدمات مضافة بعد</p>
                        </div>
                      </td>
                    </tr>
                  )
                  : services.map((svc) => {
                      const hasSteps = svc.name !== 'نقل داخلي'
                      const isExpanded = expandedId === svc.id
                      return (
                        <Fragment key={svc.id}>
                          <tr
                            className={`border-b border-gray-100 transition-colors
                              ${hasSteps ? 'hover:bg-sky-50/40 cursor-pointer select-none' : 'cursor-default'}
                              ${isExpanded ? 'bg-sky-50/60' : ''}`}
                            onClick={() => hasSteps && toggleExpand(svc.id)}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                  hasSteps ? 'bg-sky-400' : 'bg-gray-300'
                                }`} />
                                <span className="font-semibold text-gray-900">{svc.name ?? '—'}</span>
                                {svc.name && <CopyButton value={svc.name} label="الخدمة" />}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {hasSteps ? (
                                <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full
                                                 bg-sky-100 text-sky-700 text-xs font-bold px-2">
                                  {svc._count.steps}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full
                                               bg-gray-100 text-gray-600 text-xs font-semibold px-2">
                                {svc._count.clients}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-400">
                              {hasSteps && (
                                <svg
                                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </td>
                          </tr>

                          {hasSteps && isExpanded && (
                            <tr>
                              <td colSpan={4} className="p-0">
                                <StepsPanel serviceId={svc.id} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
