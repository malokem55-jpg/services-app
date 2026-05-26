import { useState } from 'react'

interface Props {
  count: number
  badgeColor: string
  title: string
  children: React.ReactNode
}

export default function NotificationBell({ count, badgeColor, title, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="relative flex items-center justify-center w-9 h-9 rounded-full
                   text-sky-100 hover:text-white hover:bg-sky-600 transition-colors"
        aria-label={title}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(v => !v)}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {isOpen && (
        <div
          dir="rtl"
          className="absolute top-11 end-0 w-80 max-h-96 bg-white rounded-xl shadow-2xl
                     border border-gray-100 z-50 overflow-hidden flex flex-col"
        >
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          </div>
          {count === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">لا توجد تنبيهات</p>
          ) : (
            <div className="overflow-y-auto">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
