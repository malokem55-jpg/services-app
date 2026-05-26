import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Logo from './Logo'
import NotificationBell from './NotificationBell'
import { useNotifications } from '../hooks/useNotifications'
import type { MonthlyPaymentAlert, IqamaAlert } from '../hooks/useNotifications'

interface Me { name: string | null; username: string | null }

const NAV_LINKS = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/clients', label: 'العملاء', end: false },
  { to: '/organizations', label: 'المؤسسات', end: false },
  { to: '/services', label: 'الخدمات', end: false },
]

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function MonthlyItem({ item }: { item: MonthlyPaymentAlert }) {
  return (
    <div className="px-4 py-3 border-e-4 border-violet-400 bg-gray-50 text-sm text-gray-700 leading-relaxed">
      <p>
        لديك دفعية قادمة من <span className="font-semibold">{item.name ?? '—'}</span>
        {item.service?.name ? ` [${item.service.name}]` : ''}
      </p>
      <p>بتاريخ ({fmtDate(item.nextPaymentDate)})</p>
      <p className="text-violet-700 font-medium">المبلغ: {item.amount ?? '—'}</p>
    </div>
  )
}

function IqamaItem({ item, borderColor }: { item: IqamaAlert; borderColor: string }) {
  return (
    <div className={`px-4 py-3 border-e-4 ${borderColor} bg-gray-50 text-sm text-gray-700 leading-relaxed`}>
      <p>
        صاحب الاقامة <span className="font-semibold">{item.name ?? '—'}</span>
        {item.service?.name ? ` [${item.service.name}]` : ''}
        {item.iqamaNumber ? ` بالرقم (${item.iqamaNumber})` : ''}
        {item.organization?.name ? ` ضمن مؤسسة ( ${item.organization.name} )` : ''}
      </p>
      <p>ستنتهي بتاريخ : {fmtDate(item.iqamaEndDate)}</p>
      {item.paymentType && <p>( {item.paymentType} )</p>}
    </div>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: me } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => apiFetch<Me>('/api/auth/me'),
    staleTime: 10 * 60 * 1000,
  })

  const { data: notifs } = useNotifications()

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
              {NAV_LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `text-sm px-4 py-1.5 rounded-lg font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-sky-100 hover:text-white hover:bg-sky-600'
                    }`
                  }
                >
                  {label}
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

              {/* Divider — desktop */}
              <span className="hidden sm:block h-5 w-px bg-sky-500/50 mx-3" />

              {/* Notification bells */}
              <div className="flex items-center gap-1">
                <NotificationBell
                  count={notifs?.monthlyPayments.length ?? 0}
                  badgeColor="bg-violet-500"
                  title="تنبيهات الدفعيات الشهرية"
                >
                  {notifs?.monthlyPayments.map(item => (
                    <MonthlyItem key={item.id} item={item} />
                  ))}
                </NotificationBell>

                <NotificationBell
                  count={notifs?.iqamaExpirySoon.length ?? 0}
                  badgeColor="bg-amber-500"
                  title="تنبيهات الاقامات قبل 30 يوم"
                >
                  {notifs?.iqamaExpirySoon.map(item => (
                    <IqamaItem key={item.id} item={item} borderColor="border-amber-400" />
                  ))}
                </NotificationBell>

                <NotificationBell
                  count={notifs?.iqamaExpired.length ?? 0}
                  badgeColor="bg-red-500"
                  title="تنبيهات الاقامات"
                >
                  {notifs?.iqamaExpired.map(item => (
                    <IqamaItem key={item.id} item={item} borderColor="border-red-400" />
                  ))}
                </NotificationBell>
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
          <div className="absolute inset-y-0 start-0 w-72 bg-white shadow-2xl flex flex-col drawer-enter"
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
              {NAV_LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-sky-700'
                    }`
                  }
                >
                  {label}
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
    </>
  )
}
