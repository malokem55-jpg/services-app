import { Link } from 'react-router-dom'

/**
 * شريط علوي لشاشات النسخة المخصصة: زر رجوع للرئيسية المخصصة + عنوان الشاشة.
 * pt-safe لمراعاة النوتش في الـ PWA المثبت على الآيفون (status bar شفاف).
 */
export default function MobileScreenHeader({ title, accent }: { title: string; accent: string }) {
  return (
    <header
      className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2 px-3 h-14">
        <Link
          to="/m"
          aria-label="رجوع للرئيسية"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500
                     hover:bg-gray-100 active:bg-gray-100 transition-colors"
        >
          {/* سهم لليمين: الرجوع في واجهة RTL */}
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <span className={`w-1.5 h-6 rounded-full ${accent}`} />
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
      </div>
    </header>
  )
}
