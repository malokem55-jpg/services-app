import MobileScreenHeader from '../components/MobileScreenHeader'
import { useLoginPlatforms } from '../hooks/useLoginPlatforms'

// رسالة التأكيد عند فتح مقيم: تؤكد الفتح وتذكّر بخطوة التعبئة من المفضلة
const OPEN_CONFIRM =
  'سنفتح منصة مقيم الآن.\n\nبعد فتحها، افتح المفضلة واضغط «تعبئة مقيم»، ثم اختر المؤسسة لتعبئة بياناتها.'

/**
 * شاشة منصة مقيم المخصصة (PWA): فعل يومي واحد — «فتح مقيم». تجهيز/تحديث «الزر الموحّد»
 * انتقل إلى الإعدادات (فعل صيانة نادر). عند الفتح تظهر رسالة تأكيد تذكّر بخطوة التعبئة
 * من مفضلة Safari. التعبئة الفعلية تتم من الزر المحفوظ على صفحة مقيم.
 */
export default function MobileMuqeemPage() {
  const { data: platforms = [] } = useLoginPlatforms()
  const muqeem = platforms.find((p) => p.key === 'muqeem')

  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="منصة مقيم" accent="bg-sky-500" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-4 pb-10">
        <p className="text-xs text-gray-500 leading-relaxed px-1">
          اضغط «فتح مقيم»، ثم من مفضلة Safari اضغط «تعبئة مقيم» واختر المؤسسة لتتعبأ بياناتها تلقائياً.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {muqeem?.loginUrl ? (
            <a
              href={muqeem.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // التأكيد متزامن: لو رفضه المستخدم نمنع فتح الرابط
                if (!window.confirm(OPEN_CONFIRM)) e.preventDefault()
              }}
              className="flex items-center justify-center gap-2 w-full rounded-xl
                         bg-sky-500 active:bg-sky-600 text-white text-sm font-semibold
                         py-3.5 min-h-12 shadow-sm shadow-sky-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              فتح مقيم
            </a>
          ) : (
            <p className="text-center text-sm text-gray-400 py-2">
              رابط منصة مقيم غير مضبوط — اضبطه من الملف الشخصي في النسخة الكاملة
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
