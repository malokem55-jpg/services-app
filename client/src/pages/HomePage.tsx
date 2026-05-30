import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'

interface Stats {
  clientsCount: number
  organizationsCount: number
  usersCount: number
}

const CARDS = [
  {
    key: 'clientsCount' as const,
    label: 'العملاء',
    href: '/clients',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
      </svg>
    ),
    accent: 'bg-sky-500',
    iconBg: 'bg-sky-100 text-sky-600',
    gradient: 'from-sky-50 to-white',
    border: 'border-sky-100',
  },
  {
    key: 'organizationsCount' as const,
    label: 'المؤسسات',
    href: '/organizations',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h6" />
      </svg>
    ),
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-100 text-emerald-600',
    gradient: 'from-emerald-50 to-white',
    border: 'border-emerald-100',
  },
  {
    key: 'usersCount' as const,
    label: 'المستخدمين',
    href: undefined,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    accent: 'bg-violet-500',
    iconBg: 'bg-violet-100 text-violet-600',
    gradient: 'from-violet-50 to-white',
    border: 'border-violet-100',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => apiFetch<Stats>('/api/stats'),
  })

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6 page-enter">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">نظرة عامة</h2>
          <p className="text-sm text-gray-500 mt-0.5">ملخص بيانات النظام</p>
        </div>

        {isError && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd" />
            </svg>
            تعذّر تحميل الإحصائيات، حاول تحديث الصفحة.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CARDS.map(({ key, label, icon, iconBg, gradient, border, accent, href }) => (
            <div
              key={key}
              onClick={() => href && navigate(href)}
              className={`bg-linear-to-br ${gradient} rounded-2xl border ${border} shadow-sm
                          overflow-hidden relative${href ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            >
              {/* Top accent bar */}
              <div className={`h-1 w-full ${accent}`} />

              <div className="p-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
                  {icon}
                </div>

                {isLoading ? (
                  <>
                    <div className="h-9 w-16 rounded-lg bg-gray-200/70 animate-pulse mb-2" />
                    <div className="h-4 w-20 rounded bg-gray-200/70 animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold text-gray-900 leading-none tabular-nums mb-1">
                      {data ? data[key].toLocaleString('ar-SA') : '—'}
                    </p>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
