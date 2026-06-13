import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useNotifications } from '../hooks/useNotifications'

interface ActionCard {
  to: string
  label: string
  description: string
  count: number
  tile: string
  pill: string
  icon: React.ReactNode
}

const todayLabel = new Date().toLocaleDateString('ar-EG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * الرئيسية المخصصة (تطبيق الموبايل المثبت): رأس ترحيبي بلون العلامة يلخّص ما يحتاج
 * متابعة، ثم ثلاث بطاقات مهام هادئة — اللون لمسة على الأيقونة فقط لإبقاء التسلسل
 * الهرمي واضحاً. أيقونة الإعدادات تصل لتاب PWA لإلغاء الوضع المخصص عند الحاجة.
 */
export default function MobileHomePage() {
  const { data: notifs } = useNotifications()

  const monthlyCount = notifs?.monthlyPayments.length ?? 0
  const iqamaCount = (notifs?.iqamaExpired.length ?? 0) + (notifs?.iqamaExpirySoon.length ?? 0)

  const ACTIONS: ActionCard[] = [
    {
      to: '/m/muqeem',
      label: 'منصة مقيم',
      description: 'فتح المنصة ببيانات مؤسسة',
      count: 0,
      tile: 'bg-sky-100 text-sky-600',
      pill: 'bg-sky-100 text-sky-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      to: '/m/payments',
      label: 'الدفعات الشهرية',
      description: 'عرض الدفعات المستحقة وتسديدها',
      count: monthlyCount,
      tile: 'bg-violet-100 text-violet-600',
      pill: 'bg-violet-100 text-violet-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      to: '/m/iqama',
      label: 'تجديد إقامة',
      description: 'متابعة الإقامات وتحديث تاريخ الانتهاء',
      count: iqamaCount,
      tile: 'bg-emerald-100 text-emerald-600',
      pill: 'bg-emerald-100 text-emerald-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
  ]

  const pendingTotal = monthlyCount + iqamaCount

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col page-enter"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── شريط العلامة + الإعدادات ── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-1">
        <Logo size="sm" />
        <Link
          to="/m/settings"
          aria-label="الإعدادات"
          className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500
                     bg-white border border-gray-200/70 shadow-sm
                     active:scale-95 active:bg-gray-50 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 px-4 pt-3 pb-8 max-w-md w-full mx-auto">
        {/* ── رأس ترحيبي بلون العلامة ── */}
        <section
          className="relative overflow-hidden rounded-3xl px-6 py-6 mb-5
                     bg-linear-to-bl from-sky-500 to-sky-700 text-white shadow-lg shadow-sky-500/25"
        >
          {/* دائرتان زخرفيتان خفيفتان */}
          <div className="absolute -top-10 -inset-s-10 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -inset-e-6 w-28 h-28 rounded-full bg-white/5" />

          <div className="relative">
            <p className="text-xs text-white/70">{todayLabel}</p>
            <h1 className="text-xl font-bold mt-1">أهلاً بك 👋</h1>
            <p className="text-sm text-white/85 mt-2 leading-relaxed">
              {pendingTotal > 0 ? (
                <>
                  لديك{' '}
                  <span className="font-bold">{pendingTotal}</span>{' '}
                  {pendingTotal === 1 ? 'مهمة' : 'مهمة'} بحاجة لمتابعة اليوم
                </>
              ) : (
                'كل مهامك منجَزة — لا يوجد ما يحتاج متابعة ✨'
              )}
            </p>
          </div>
        </section>

        {/* ── بطاقات المهام ── */}
        <div className="space-y-3">
          {ACTIONS.map(({ to, label, description, count, tile, pill, icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 rounded-2xl bg-white px-4 py-4
                         border border-gray-100 shadow-sm
                         active:scale-[0.99] active:bg-gray-50/80 transition-all"
            >
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tile}`}>
                {icon}
              </span>

              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-base font-bold text-gray-900 truncate">{label}</span>
                  {count > 0 && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold
                                      flex items-center justify-center shrink-0 ${pill}`}>
                      {count}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5 truncate">{description}</span>
              </span>

              <svg
                className="w-5 h-5 text-gray-300 shrink-0 group-active:text-gray-400 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
