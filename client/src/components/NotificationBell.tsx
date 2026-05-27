import type { ReactNode } from 'react'
// no useState needed — mobile state is managed by parent

interface Props {
  count: number
  badgeColor: string
  title: string
  children: ReactNode
  ringDelay?: string
  mobileOpen?: boolean
  onMobileToggle?: () => void
}

export default function NotificationBell({
  count, badgeColor, title, children, ringDelay = '0s',
  mobileOpen = false, onMobileToggle,
}: Props) {

  return (
    <div className="relative group">
      <button
        className="relative flex items-center justify-center w-9 h-9 rounded-full
                   text-sky-100 hover:text-white hover:bg-sky-600 transition-colors"
        aria-label={title}
        onClick={() => onMobileToggle?.()}
      >
        <svg
          className={`w-5 h-5 ${count > 0 ? 'bell-ring' : ''}`}
          style={{ '--bell-delay': ringDelay } as React.CSSProperties}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                           ${badgeColor} text-white text-[10px] font-bold
                           rounded-full flex items-center justify-center leading-none`}>
            {count > 999 ? '999+' : count}
          </span>
        )}
      </button>

      {/*
        القائمة تبدأ من top-9 (نهاية الزر مباشرة) بدون فراغ.
        pt-3 داخلها يصنع المسافة البصرية فقط، بينما منطقة الـ hover متصلة.
      */}
      <div
        className={`
          hidden sm:block
          absolute top-9 inset-e-0 w-80 pt-3 z-50
          sm:opacity-0 sm:invisible
          sm:group-hover:opacity-100 sm:group-hover:visible
          transition-all duration-200 ease-in-out
        `}
      >
        <div
          dir="rtl"
          className="bg-white rounded-xl shadow-2xl border border-gray-100
                     max-h-96 overflow-hidden flex flex-col"
        >
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          </div>
          {count === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">لا توجد تنبيهات</p>
          ) : (
            <div className="overflow-y-auto divide-y divide-gray-100">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* موبايل فقط */}
      {mobileOpen && (
        <>
          {/* Backdrop — اضغط خارج القائمة لإغلاقها (يبدأ من أسفل الناف بار) */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 sm:hidden"
            style={{ top: 'calc(env(safe-area-inset-top) + 3.5rem)' }}
            onClick={() => onMobileToggle?.()}
          />

          {/* Panel — تحت شريط التنقل مباشرة مع مراعاة safe-area للآيفون */}
          <div
            dir="rtl"
            className="fixed inset-x-2 max-h-[65vh] bg-white rounded-xl shadow-2xl
                       border border-gray-100 z-50 overflow-hidden flex flex-col sm:hidden"
            style={{ top: 'calc(env(safe-area-inset-top) + 3.75rem)' }}
          >
            {/* Header مع زر إغلاق */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
              <button
                onClick={() => onMobileToggle?.()}
                className="w-7 h-7 flex items-center justify-center rounded-lg
                           text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="إغلاق"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {count === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">لا توجد تنبيهات</p>
            ) : (
              <div className="overflow-y-auto divide-y divide-gray-100">
                {children}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
