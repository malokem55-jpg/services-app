import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Logo from './Logo'
import Modal from './Modal'
import NotificationBell from './NotificationBell'
import WhatsAppButton from './WhatsAppButton'
import { useNotifications, isIqamaExpired } from '../hooks/useNotifications'
import type { MonthlyPaymentAlert, CustomPaymentAlert, IqamaAlert, TafweedAlert } from '../hooks/useNotifications'
import { arabicDayName } from '../lib/clientForm'
import { useUiSettings } from '../hooks/useUiSettings'

interface Me { name: string | null; username: string | null }

const NAV_LINKS = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/organizations', label: 'المؤسسات', end: false },
  // مطابقة تامة حتى لا يُميَّز "العملاء" تلقائياً في /clients/:id — التمييز هناك يتبع الصفحة المصدر
  { to: '/clients', label: 'العملاء', end: true },
  { to: '/under-procedure-clients', label: 'تحت الإجراء', end: false },
  { to: '/iqama-alerts-clients', label: 'تنبيهات الإقامات', end: false },
  { to: '/deleted-client-dues', label: 'ديون المحذوفين', end: false },
  { to: '/services', label: 'الخطوات', end: false },
]

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

// رسالة تذكير الدفعة التي تُعبَّأ مسبقاً في محادثة واتساب مع العميل
function paymentReminderMessage(item: MonthlyPaymentAlert): string {
  const name = item.client?.name ?? ''
  const amount = item.amount != null ? `${item.amount} ريال` : ''
  const date = item.receivedDate ? item.receivedDate.slice(0, 10) : ''
  return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date} بمبلغ ${amount}.\nنشكر لكم تعاونكم.`
}

function MonthlyItem({ item }: { item: MonthlyPaymentAlert }) {
  const iqamaExpired = isIqamaExpired(item.client?.iqamaEndDate)
  return (
    <div className="flex border-b border-gray-100 last:border-b-0">
      <div className={`w-1 shrink-0 ${iqamaExpired ? 'bg-red-500' : 'bg-violet-500'} rounded-ss`} />
      <div className="flex-1 px-3 py-4 text-sm text-gray-700 leading-relaxed">
        <p>
          لديك دفعية قادمة من {item.client?.name ?? '—'}
          {item.client?.service?.name ? ` [${item.client.service.name}]` : ''}
          {iqamaExpired && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700
                             text-[10px] font-bold px-2 py-0.5 ms-1.5 align-middle">
              إقامة منتهية
            </span>
          )}
        </p>
        <p className="mt-0.5">
          بتاريخ ({fmtDate(item.receivedDate)})
          {' '}<span className="font-semibold text-violet-600">المبلغ: {item.amount ?? '—'}</span>
          {item.carriedOverAmount != null && item.carriedOverAmount > 0 && (
            <> (منها {item.carriedOverAmount} مرحّلة من دفعية بتاريخ {item.carriedFromMonth ?? '—'})</>
          )}
        </p>
      </div>
      {/* زر واتساب يظهر فقط إذا كان للعميل رقم هاتف */}
      {item.client?.phone && (
        <div className="flex items-center pe-3">
          <WhatsAppButton
            phone={item.client.phone}
            name={item.client.name}
            message={paymentReminderMessage(item)}
          />
        </div>
      )}
    </div>
  )
}

function CustomPaymentItem({ item }: { item: CustomPaymentAlert }) {
  return (
    <div className="flex border-b border-gray-100 last:border-b-0">
      <div className="w-1 shrink-0 bg-red-500 rounded-ss" />
      <div className="flex-1 px-3 py-4 text-sm text-gray-700 leading-relaxed">
        <p>
          صاحب الاقامة {item.name ?? '—'}
          {item.service?.name ? ` [${item.service.name}]` : ''}
          {item.iqamaNumber ? ` بالرقم (${item.iqamaNumber})` : ''}
          {item.organization?.name ? ` ضمن مؤسسة ( ${item.organization.name} )` : ''}
        </p>
        <p className="mt-0.5">
          لديه دفعية قادمة بتاريخ: {fmtDate(item.nextPaymentDate)}
        </p>
      </div>
    </div>
  )
}

function IqamaItem({ item, accentColor }: { item: IqamaAlert; accentColor: string }) {
  return (
    <div className="flex border-b border-gray-100 last:border-b-0">
      <div className={`w-1 shrink-0 ${accentColor} rounded-ss`} />
      <div className="flex-1 px-3 py-4 text-sm text-gray-700 leading-relaxed">
        <p>
          صاحب الاقامة <span className="font-semibold text-gray-900">{item.name ?? '—'}</span>
          {item.service?.name ? ` [${item.service.name}]` : ''}
          {item.iqamaNumber ? ` بالرقم (${item.iqamaNumber})` : ''}
        </p>
        {item.organization?.name && (
          <p className="mt-0.5 text-gray-500">ضمن مؤسسة ({item.organization.name})</p>
        )}
        <p className="mt-0.5 text-gray-500">ستنتهي بتاريخ: {fmtDate(item.iqamaEndDate)}</p>
        {item.paymentType && (
          <p className="mt-0.5 font-medium text-gray-600">( دفع {item.paymentType} )</p>
        )}
      </div>
    </div>
  )
}

// عنصر تنبيه تفويض واحد — زر "تم التفويض" يفتح نافذة تأكيد قبل إخفاء التنبيه
function TafweedItem({ item, onDone }: { item: TafweedAlert; onDone: () => void }) {
  return (
    <div className="flex border-b border-gray-100 last:border-b-0">
      <div className="w-1 shrink-0 bg-orange-500 rounded-ss" />
      <div className="flex-1 px-3 py-4 text-sm text-gray-700 leading-relaxed">
        <p>
          تذكير: يجب إجراء التفويض للعميل{' '}
          <span className="font-semibold text-gray-900">{item.name ?? '—'}</span>
          {item.organization?.name ? ` على مؤسسة (${item.organization.name})` : ''} اليوم
        </p>
        <p className="mt-0.5 text-gray-500">
          تاريخ التنبيه: {fmtDate(item.tafweedAlertDate)}
          {item.tafweedAlertDate ? ` (${arabicDayName(item.tafweedAlertDate)})` : ''}
        </p>
        <button
          onClick={onDone}
          className="mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white
                     text-xs font-semibold px-3 py-1.5 transition-colors"
        >
          تم التفويض
        </button>
      </div>
    </div>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openBell, setOpenBell] = useState<string | null>(null)
  // تنبيه التفويض الذي ينتظر تأكيد "تم التفويض" في النافذة
  const [confirmTafweed, setConfirmTafweed] = useState<TafweedAlert | null>(null)

  // تأكيد التفويض يعلّم التنبيه منجزاً فيختفي من الجرس،
  // ويبقى التاريخ محفوظاً لعرض "تم التفويض" في تفاصيل العميل
  const markTafweedDone = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ tafweedDone: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client'] })
      setConfirmTafweed(null)
    },
  })

  function toggleBell(id: string) {
    setOpenBell(prev => prev === id ? null : id)
  }
  const { data: me } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => apiFetch<Me>('/api/auth/me'),
    staleTime: 10 * 60 * 1000,
  })

  const { data: notifs } = useNotifications()
  const { data: uiSettings } = useUiSettings()

  // في صفحة تفاصيل عميل يُميَّز رابط الصفحة المصدر (تمررها الصفحات في state عند الفتح)،
  // وعند الفتح المباشر دون مصدر يُميَّز "العملاء" افتراضياً
  const onClientDetail = /^\/clients\/.+/.test(location.pathname)
  const detailSource = onClientDetail
    ? ((location.state as { from?: string } | null)?.from ?? '/clients')
    : null

  // الروابط المرئية حسب الإعدادات — تبقى ظاهرة أثناء التحميل (undefined !== false)
  // صفحة تنبيهات الإقامات افتراضياً مخفية فتُشترط القيمة الصريحة true
  const iqamaPageVisible = uiSettings?.showIqamaAlertsPage === true
  const visibleLinks = NAV_LINKS.filter(({ to }) => {
    if (to === '/under-procedure-clients') return uiSettings?.showUnderProcedurePage !== false
    if (to === '/deleted-client-dues') return uiSettings?.showDeletedDuesPage !== false
    if (to === '/iqama-alerts-clients') return iqamaPageVisible
    return true
  })

  // عدد ديون العملاء المحذوفين المعلّقة — شارة على رابط الصفحة ليبقى الدين ظاهراً
  const { data: deletedDues } = useQuery<{ status: string | null }[]>({
    queryKey: ['deleted-client-dues'],
    queryFn: () => apiFetch<{ status: string | null }[]>('/api/deleted-client-dues'),
    staleTime: 60 * 1000,
  })
  const pendingDuesCount = deletedDues?.filter(d => d.status === 'pending').length ?? 0

  const initials = me?.name
    ? me.name.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('')
    : me?.username?.[0]?.toUpperCase() ?? '؟'

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="bg-sky-700 text-white shadow-lg sticky top-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-14 flex items-center justify-between gap-3">

            {/* ── Brand / Logo ── */}
            <button
              onClick={() => navigate('/')}
              className="shrink-0 focus:outline-none"
              aria-label="الرئيسية"
            >
              <Logo size="sm" />
            </button>

            {/* ── Desktop nav links ── */}
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" aria-label="التنقل الرئيسي">
              {visibleLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `text-sm px-4 py-1.5 rounded-lg font-medium transition-all duration-150 ${
                      isActive || to === detailSource
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-sky-100 hover:text-white hover:bg-sky-600'
                    }`
                  }
                >
                  {label}
                  {to === '/deleted-client-dues' && pendingDuesCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 ms-1.5
                                     rounded-full bg-red-500 text-white text-[10px] font-bold align-middle">
                      {pendingDuesCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* ── Right-side actions ── */}
            <div className="flex items-center shrink-0">

              {/* Profile avatar — desktop */}
              <button
                onClick={() => navigate('/profile')}
                aria-label="الملف الشخصي"
                className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-xs font-bold
                            ring-2 transition-all duration-150 select-none
                            ${location.pathname === '/profile'
                              ? 'bg-white text-sky-700 ring-white'
                              : 'bg-sky-500 hover:bg-sky-400 text-white ring-sky-400 hover:ring-white'}`}
              >
                {initials}
              </button>

              {/* Settings — desktop */}
              <button
                onClick={() => navigate('/settings')}
                aria-label="الإعدادات"
                className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center ms-2
                            transition-all duration-150
                            ${location.pathname === '/settings'
                              ? 'bg-white text-sky-700'
                              : 'text-sky-100 hover:text-white hover:bg-sky-600'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Divider — desktop */}
              <span className="hidden sm:block h-5 w-px bg-sky-500/50 mx-3" />

              {/* Notification bells */}
              <div className="flex items-center gap-1">
                {uiSettings?.showBellCustomPayments !== false && (
                  <NotificationBell
                    count={notifs?.customPayments.length ?? 0}
                    badgeColor="bg-red-500"
                    title="تنبيهات الدفعيات المخصصة"
                    ringDelay="0s"
                    mobileOpen={openBell === 'custom'}
                    onMobileToggle={() => toggleBell('custom')}
                  >
                    {notifs?.customPayments.map(item => (
                      <CustomPaymentItem key={item.id} item={item} />
                    ))}
                  </NotificationBell>
                )}

                {uiSettings?.showBellMonthlyPayments !== false && (
                  <NotificationBell
                    count={notifs?.monthlyPayments.length ?? 0}
                    badgeColor="bg-violet-500"
                    title="تنبيهات الدفعيات الشهرية"
                    ringDelay="0.25s"
                    mobileOpen={openBell === 'monthly'}
                    onMobileToggle={() => toggleBell('monthly')}
                  >
                    {/* منتهية الإقامة أولاً لأنها الأكثر إلحاحاً، ثم حسب ترتيب الاستحقاق */}
                    {[...(notifs?.monthlyPayments ?? [])]
                      .sort((a, b) =>
                        Number(isIqamaExpired(b.client?.iqamaEndDate)) -
                        Number(isIqamaExpired(a.client?.iqamaEndDate)))
                      .map(item => (
                        <MonthlyItem key={item.id} item={item} />
                      ))}
                  </NotificationBell>
                )}

                {!iqamaPageVisible && uiSettings?.showBellIqamaSoon !== false && (
                  <NotificationBell
                    count={notifs?.iqamaExpirySoon.length ?? 0}
                    badgeColor="bg-amber-500"
                    title="تنبيهات الاقامات قبل 30 يوم"
                    ringDelay="0.5s"
                    mobileOpen={openBell === 'iqama-soon'}
                    onMobileToggle={() => toggleBell('iqama-soon')}
                  >
                    {notifs?.iqamaExpirySoon.map(item => (
                      <IqamaItem key={item.id} item={item} accentColor="bg-amber-500" />
                    ))}
                  </NotificationBell>
                )}

                {!iqamaPageVisible && uiSettings?.showBellIqamaExpired !== false && (
                  <NotificationBell
                    count={notifs?.iqamaExpired.length ?? 0}
                    badgeColor="bg-red-500"
                    title="تنبيهات الاقامات"
                    ringDelay="0.75s"
                    mobileOpen={openBell === 'iqama-expired'}
                    onMobileToggle={() => toggleBell('iqama-expired')}
                  >
                    {notifs?.iqamaExpired.map(item => (
                      <IqamaItem key={item.id} item={item} accentColor="bg-red-500" />
                    ))}
                  </NotificationBell>
                )}

                {uiSettings?.showBellTafweed !== false && (
                  <NotificationBell
                    count={notifs?.tafweedAlerts.length ?? 0}
                    badgeColor="bg-orange-500"
                    title="تنبيهات التفويض والتصديق"
                    ringDelay="1s"
                    mobileOpen={openBell === 'tafweed'}
                    onMobileToggle={() => toggleBell('tafweed')}
                  >
                    {notifs?.tafweedAlerts.map(item => (
                      <TafweedItem key={item.id} item={item} onDone={() => setConfirmTafweed(item)} />
                    ))}
                  </NotificationBell>
                )}
              </div>

              {/* Divider — desktop */}
              <span className="hidden sm:block h-5 w-px bg-sky-500/50 mx-3" />

              {/* Logout — desktop */}
              <button
                onClick={handleLogout}
                className="hidden sm:flex items-center gap-1.5 text-sm text-sky-100 hover:text-white
                           hover:bg-sky-600 active:bg-sky-800 rounded-lg px-3 py-1.5
                           transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                <span>خروج</span>
              </button>

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="فتح القائمة"
                className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg ms-2
                           text-sky-100 hover:text-white hover:bg-sky-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ─────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="القائمة">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-enter"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel — slides from right (RTL start side) */}
          <div className="absolute inset-y-0 inset-s-0 w-72 bg-white shadow-2xl flex flex-col drawer-enter"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-sky-700">
              <Logo size="sm" />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="إغلاق القائمة"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sky-200
                           hover:bg-sky-600 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="التنقل الرئيسي">
              {visibleLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive || to === detailSource
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-sky-700'
                    }`
                  }
                >
                  {label}
                  {to === '/deleted-client-dues' && pendingDuesCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1
                                     rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {pendingDuesCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-gray-100 px-4 py-4 space-y-2">
              <button
                onClick={() => { setDrawerOpen(false); navigate('/profile') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/profile'
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center
                                 text-xs font-bold shrink-0">
                  {initials}
                </span>
                <span>{me?.name ?? me?.username ?? 'الملف الشخصي'}</span>
              </button>

              <button
                onClick={() => { setDrawerOpen(false); navigate('/settings') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/settings'
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <span>الإعدادات</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                           text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── نافذة تأكيد "تم التفويض" ── */}
      {confirmTafweed && (
        <Modal title="تأكيد التفويض" onClose={() => setConfirmTafweed(null)}>
          <p className="text-sm text-gray-700 leading-relaxed mb-5">
            هل تم إجراء التفويض للعميل{' '}
            <span className="font-semibold text-gray-900">{confirmTafweed.name ?? '—'}</span>
            {confirmTafweed.organization?.name ? ` على مؤسسة (${confirmTafweed.organization.name})` : ''}؟
            <br />
            <span className="text-xs text-gray-500">بعد التأكيد سيختفي هذا التنبيه من جرس التنبيهات.</span>
          </p>
          {markTafweedDone.isError && (
            <p className="text-sm text-red-600 mb-4">
              {markTafweedDone.error instanceof Error ? markTafweedDone.error.message : 'حدث خطأ غير متوقع'}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmTafweed(null)}
              className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                         text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={markTafweedDone.isPending}
              onClick={() => markTafweedDone.mutate(confirmTafweed.id)}
              className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                         text-white text-sm font-semibold py-3 min-h-11 transition-colors"
            >
              {markTafweedDone.isPending ? '...' : 'تأكيد'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
