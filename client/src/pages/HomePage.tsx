import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'
import { useUiSettings } from '../hooks/useUiSettings'
import { useNotifications } from '../hooks/useNotifications'

interface Stats {
  clientsCount: number
  underProcedureCount: number
  organizationsCount: number
}

interface DeletedDueSummary {
  status: string | null
  totalDue: number | null
  collectedAmount: number | null
}

// لون كل بطاقة معرّف بأصناف ثابتة ليلتقطها Tailwind عند البناء
interface CardColor {
  card: string        // خلفية وحد البطاقة
  hoverBorder: string // لون الحد عند المرور
  icon: string        // شارة الأيقونة الملوّنة الصريحة
  value: string       // لون الرقم
  subtitle: string    // لون النص المساعد
}

interface StatCardData {
  key: string
  label: string
  value: number
  href: string
  icon: React.ReactNode
  color: CardColor
  subtitle?: React.ReactNode
  loading: boolean
}

const COLORS: Record<string, CardColor> = {
  emerald: {
    card: 'bg-emerald-50/70 border-emerald-100', hoverBorder: 'hover:border-emerald-300',
    icon: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
    value: 'text-emerald-700', subtitle: 'text-emerald-600',
  },
  blue: {
    card: 'bg-blue-50/70 border-blue-100', hoverBorder: 'hover:border-blue-300',
    icon: 'bg-blue-500 text-white shadow-sm shadow-blue-500/30',
    value: 'text-blue-700', subtitle: 'text-blue-600',
  },
  amber: {
    card: 'bg-amber-50/70 border-amber-100', hoverBorder: 'hover:border-amber-300',
    icon: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
    value: 'text-amber-700', subtitle: 'text-amber-600',
  },
  orange: {
    card: 'bg-orange-50/70 border-orange-100', hoverBorder: 'hover:border-orange-300',
    icon: 'bg-orange-500 text-white shadow-sm shadow-orange-500/30',
    value: 'text-orange-700', subtitle: 'text-orange-600',
  },
  rose: {
    card: 'bg-rose-50/70 border-rose-100', hoverBorder: 'hover:border-rose-300',
    icon: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30',
    value: 'text-rose-700', subtitle: 'text-rose-600',
  },
}

const ICONS = {
  organizations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h6" />
    </svg>
  ),
  clients: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
    </svg>
  ),
  underProcedure: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  iqama: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  ),
  dues: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

function StatCard({ label, value, href, icon, color, subtitle, loading }: StatCardData) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={`group text-start rounded-2xl border p-5 ${color.card}
                  shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${color.hoverBorder}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {loading ? (
            <div className="h-9 w-16 rounded-lg bg-black/5 animate-pulse mt-2" />
          ) : (
            <p className={`text-3xl font-extrabold leading-none tabular-nums mt-2 ${color.value}`}>
              {value.toLocaleString('en-US')}
            </p>
          )}
        </div>

        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                          transition-transform duration-200 group-hover:scale-105 ${color.icon}`}>
          {icon}
        </span>
      </div>

      {!loading && subtitle && (
        <p className={`text-xs font-semibold mt-3 ${color.subtitle}`}>{subtitle}</p>
      )}
    </button>
  )
}

export default function HomePage() {
  const { data, isLoading, isError } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => apiFetch<Stats>('/api/stats'),
  })

  // إعدادات الإظهار والإخفاء — الكروت تبقى ظاهرة أثناء التحميل (undefined !== false)
  const { data: uiSettings } = useUiSettings()
  const showUnderProcedure = uiSettings?.showUnderProcedurePage !== false
  const showDeletedDues = uiSettings?.showDeletedDuesPage !== false
  // صفحة تنبيهات الإقامات افتراضياً مخفية فتُشترط القيمة الصريحة true
  const showIqamaAlerts = uiSettings?.showIqamaAlertsPage === true

  // عدد عملاء تنبيهي الإقامات — نفس بيانات الأجراس
  const { data: notifs, isLoading: notifsLoading } = useNotifications()
  const iqamaExpiredCount = notifs?.iqamaExpired.length ?? 0
  const iqamaSoonCount = notifs?.iqamaExpirySoon.length ?? 0

  // ديون العملاء المحذوفين المعلّقة — نفس مفتاح الاستعلام المستخدم في Navbar وصفحة الديون
  const { data: deletedDues, isLoading: duesLoading } = useQuery<DeletedDueSummary[]>({
    queryKey: ['deleted-client-dues'],
    queryFn: () => apiFetch<DeletedDueSummary[]>('/api/deleted-client-dues'),
    staleTime: 60 * 1000,
  })
  const pendingDues = (deletedDues ?? []).filter((d) => d.status === 'pending')
  const pendingDuesTotal = pendingDues.reduce(
    (sum, d) => sum + (d.totalDue ?? 0) - (d.collectedAmount ?? 0), 0)

  // ترتيب البطاقات: المؤسسات، العملاء، تحت الإجراء، تنبيهات الإقامات، ديون المحذوفين
  const cards: (StatCardData | null)[] = [
    {
      key: 'organizations', label: 'المؤسسات', value: data?.organizationsCount ?? 0,
      href: '/organizations', icon: ICONS.organizations, color: COLORS.emerald, loading: isLoading,
    },
    {
      key: 'clients', label: 'العملاء', value: data?.clientsCount ?? 0,
      href: '/clients', icon: ICONS.clients, color: COLORS.blue, loading: isLoading,
    },
    showUnderProcedure ? {
      key: 'underProcedure', label: 'عملاء تحت الإجراء', value: data?.underProcedureCount ?? 0,
      href: '/under-procedure-clients', icon: ICONS.underProcedure, color: COLORS.amber, loading: isLoading,
    } : null,
    showIqamaAlerts ? {
      key: 'iqama', label: 'عملاء تنبيهات الإقامات', value: iqamaExpiredCount + iqamaSoonCount,
      href: '/iqama-alerts-clients', icon: ICONS.iqama, color: COLORS.orange, loading: notifsLoading,
      subtitle: `منتهية: ${iqamaExpiredCount.toLocaleString('en-US')} | قبل 30 يوم: ${iqamaSoonCount.toLocaleString('en-US')}`,
    } : null,
    showDeletedDues ? {
      key: 'dues', label: 'ديون المحذوفين المعلّقة', value: pendingDues.length,
      href: '/deleted-client-dues', icon: ICONS.dues, color: COLORS.rose, loading: duesLoading,
      subtitle: pendingDuesTotal > 0 ? `إجمالي متبقٍ: ${pendingDuesTotal.toLocaleString('en-US')} ر.س` : undefined,
    } : null,
  ]

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

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.filter((c): c is StatCardData => c !== null).map(({ key, ...rest }) => (
            <StatCard key={key} {...rest} />
          ))}
        </div>
      </main>
    </div>
  )
}
