import { useState } from 'react'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import { useLoginPlatforms } from '../hooks/useLoginPlatforms'

/**
 * شاشة منصة مقيم المخصصة (PWA): فعل يومي واحد — «فتح مقيم». الضغط يعرض نافذة تأكيد
 * فيها رسالة تذكّر بخطوة التعبئة من مفضلة Safari وزر «فتح» (الفتح يتم من داخل النافذة،
 * بنقرة جديدة، حتى لا يحجبه Safari). تجهيز/تحديث «الزر الموحّد» في الإعدادات.
 */
export default function MobileMuqeemPage() {
  const [showConfirm, setShowConfirm] = useState(false)
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
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex items-center justify-center gap-2 w-full rounded-xl
                         bg-sky-500 active:bg-sky-600 text-white text-sm font-semibold
                         py-3.5 min-h-12 shadow-sm shadow-sky-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              فتح مقيم
            </button>
          ) : (
            <p className="text-center text-sm text-gray-400 py-2">
              رابط منصة مقيم غير مضبوط — اضبطه من الملف الشخصي في النسخة الكاملة
            </p>
          )}
        </div>
      </main>

      {/* ── نافذة التأكيد ── */}
      {showConfirm && muqeem?.loginUrl && (
        <Modal title="فتح منصة مقيم" size="sm" onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              بعد فتح المنصة، افتح مفضلة Safari واضغط <span className="font-semibold text-gray-800">«تعبئة مقيم»</span>،
              ثم اختر المؤسسة لتعبئة بياناتها تلقائياً.
            </p>

            <a
              href={muqeem.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowConfirm(false)}
              className="flex items-center justify-center gap-2 w-full rounded-xl
                         bg-sky-500 active:bg-sky-600 text-white text-sm font-semibold
                         py-3 min-h-12 shadow-sm shadow-sky-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              فتح
            </a>

            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="w-full rounded-xl border border-gray-200 bg-white text-gray-600
                         text-sm font-semibold py-2.5 min-h-11 active:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
