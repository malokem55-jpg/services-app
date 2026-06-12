import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useNotifications } from '../hooks/useNotifications'

interface ActionButton {
  to: string
  label: string
  description: string
  count?: number
  gradient: string
  shadow: string
  icon: React.ReactNode
}

/**
 * الرئيسية المخصصة (تطبيق الموبايل المثبت): ثلاث مهام فقط بأزرار كبيرة،
 * وأيقونة إعدادات صغيرة للوصول لتاب PWA وإلغاء الوضع المخصص عند الحاجة.
 */
export default function MobileHomePage() {
  const { data: notifs } = useNotifications()

  const monthlyCount = notifs?.monthlyPayments.length ?? 0
  const iqamaCount = (notifs?.iqamaExpired.length ?? 0) + (notifs?.iqamaExpirySoon.length ?? 0)

  const ACTIONS: ActionButton[] = [
    {
      to: '/m/muqeem',
      label: 'منصة مقيم',
      description: 'فتح المنصة ببيانات مؤسسة',
      gradient: 'from-sky-500 to-sky-600',
      shadow: 'shadow-sky-500/30',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      to: '/m/payments',
      label: 'تنبيهات الدفعات الشهرية',
      description: 'عرض الدفعات المستحقة وتسديدها',
      count: monthlyCount,
      gradient: 'from-violet-500 to-violet-600',
      shadow: 'shadow-violet-500/30',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      to: '/m/iqama',
      label: 'تجديد إقامة',
      description: 'تنبيهات الإقامات وتحديث تاريخ الانتهاء',
      count: iqamaCount,
      gradient: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-emerald-500/30',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="min-h-screen bg-gray-50/80 flex flex-col page-enter"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── الشعار + زر الإعدادات ── */}
      <header className="flex items-center justify-between px-5 pt-6">
        <Logo size="sm" />
        <Link
          to="/m/settings"
          aria-label="الإعدادات"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400
                     bg-white border border-gray-100 shadow-sm
                     hover:text-sky-600 active:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      {/* ── أزرار المهام الثلاث ── */}
      <main className="flex-1 flex flex-col justify-center gap-4 px-5 pb-16 max-w-md w-full mx-auto">
        {ACTIONS.map(({ to, label, description, count, gradient, shadow, icon }) => (
          <Link
            key={to}
            to={to}
            className={`relative flex items-center gap-4 rounded-3xl bg-gradient-to-l ${gradient}
                        text-white px-6 py-6 shadow-lg ${shadow}
                        active:scale-[0.98] transition-transform`}
          >
            <span className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              {icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-lg font-bold leading-tight">{label}</span>
              <span className="block text-xs text-white/75 mt-1">{description}</span>
            </span>
            {count !== undefined && count > 0 && (
              <span className="absolute top-3 inset-e-3 min-w-6 h-6 px-1.5 rounded-full bg-white
                               text-gray-900 text-xs font-bold flex items-center justify-center shadow">
                {count}
              </span>
            )}
            <svg className="w-5 h-5 text-white/60 shrink-0 rotate-180" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </main>
    </div>
  )
}
