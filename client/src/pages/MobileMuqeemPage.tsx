import { useState } from 'react'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import { buildUnifiedFillBookmarklet } from '../lib/bookmarklet'
import {
  useLoginPlatforms,
  useCredentialSummaries,
  useMuqeemFillList,
} from '../hooks/useLoginPlatforms'

/**
 * شاشة منصة مقيم المخصصة (PWA): بطاقة واحدة لـ«الزر الموحّد».
 *   «نسخ زر مقيم الموحّد» يجلب بيانات كل المؤسسات ويبني زرًا سحريًا يحملها بداخله
 *   (يُحفظ في مفضلة Safari مرة واحدة) — يتجاوز حجب CSP في مقيم لأنه لا يتصل بأي خادم.
 *   «فتح مقيم» يفتح الموقع، ولا يُفعَّل إلا بعد نسخ الزر (إرشاد للترتيب الصحيح).
 * التعبئة الفعلية تحدث من الزر المحفوظ في Safari: يعرض قائمة بحث، تختار المؤسسة فتتعبأ.
 */
export default function MobileMuqeemPage() {
  const [prepared, setPrepared] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const { data: platforms = [] } = useLoginPlatforms()
  const { data: summaries = [], isLoading: summariesLoading } = useCredentialSummaries()
  const muqeem = platforms.find((p) => p.key === 'muqeem')
  const muqeemCount = summaries.filter((s) => s.platform === 'muqeem').length

  // البيانات تُجلب مسبقًا (بمجرد معرفة وجود مؤسسات) حتى يكون النسخ فوريًا داخل اللمسة
  const fillList = useMuqeemFillList(muqeemCount > 0)

  // النسخ متزامن: لا await قبل clipboard.writeText وإلا رفض Safari الكتابة في الحافظة
  async function copyUnifiedButton() {
    setError(false)
    const data = fillList.data
    if (!data || data.length === 0) {
      setError(true)
      return
    }
    try {
      await navigator.clipboard.writeText(buildUnifiedFillBookmarklet(data))
      setPrepared(true)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError(true)
    }
  }

  // الزر مشغول حتى تكتمل أول جلب للبيانات
  const busy = muqeemCount > 0 && fillList.isLoading

  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="منصة مقيم" accent="bg-sky-500" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-4 pb-10">
        <div className="flex items-start justify-between gap-2 px-1">
          <p className="flex-1 text-xs text-gray-500 leading-relaxed">
            زر واحد يحمل بيانات كل مؤسساتك. انسخه واحفظه في مفضلة Safari مرة واحدة، ثم «فتح مقيم».
            على صفحة الدخول اضغط الزر من المفضلة، ابحث عن المؤسسة واخترها لتتعبأ تلقائياً.
          </p>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="shrink-0 rounded-lg border border-gray-200 bg-white text-gray-600
                       text-xs font-semibold px-3 py-2 active:bg-gray-50"
          >
            الإرشادات
          </button>
        </div>

        {/* ── بطاقة الزر الموحّد ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-sky-50/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-sky-700">زر مقيم الموحّد</h3>
              <p className="text-xs text-gray-400">
                {summariesLoading
                  ? 'جارٍ الحساب…'
                  : muqeemCount > 0
                    ? `يحمل بيانات ${muqeemCount} مؤسسة`
                    : 'لا توجد مؤسسات مسجلة على مقيم'}
              </p>
            </div>
          </div>

          {muqeemCount === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              سجّل بيانات دخول مقيم للمؤسسات من الملف الشخصي في النسخة الكاملة أولاً
            </p>
          ) : (
            <div className="p-4 space-y-2">
              {/* 1) نسخ الزر الموحّد */}
              <button
                type="button"
                onClick={copyUnifiedButton}
                disabled={busy || !fillList.data}
                className={`flex items-center justify-center gap-2 w-full rounded-xl
                            text-sm font-semibold py-3 min-h-12 shadow-sm transition-colors disabled:opacity-60 ${
                  copied
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-sky-500 active:bg-sky-600 text-white shadow-sky-500/20'
                }`}
              >
                {busy ? (
                  'جارٍ التجهيز…'
                ) : copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    تم نسخ الزر الموحّد
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    نسخ زر مقيم الموحّد
                  </>
                )}
              </button>

              {fillList.isError && (
                <button
                  type="button"
                  onClick={() => fillList.refetch()}
                  className="w-full text-sm text-red-600 text-center py-1 active:text-red-700"
                >
                  تعذّر تحميل البيانات من الخادم — اضغط لإعادة المحاولة
                </button>
              )}

              {error && !fillList.isError && (
                <p className="text-sm text-red-600 text-center">
                  تعذّر النسخ — أعد المحاولة
                </p>
              )}

              {/* 2) فتح مقيم — مقفول حتى نسخ الزر */}
              {muqeem?.loginUrl ? (
                prepared ? (
                  <a
                    href={muqeem.loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl
                               bg-sky-500 active:bg-sky-600 text-white text-sm font-semibold
                               py-3 min-h-12 shadow-sm shadow-sky-500/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    فتح مقيم
                  </a>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="flex items-center justify-center gap-2 w-full rounded-xl
                                 bg-gray-100 text-gray-400 text-sm font-semibold
                                 py-3 min-h-12 cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      فتح مقيم
                    </button>
                    <p className="text-[11px] text-gray-400 text-center">
                      اضغط «نسخ زر مقيم الموحّد» أولاً لتفعيل الفتح
                    </p>
                  </>
                )
              ) : (
                <p className="text-center text-sm text-gray-400 py-2">
                  رابط منصة مقيم غير مضبوط — اضبطه من الملف الشخصي في النسخة الكاملة
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── نافذة الإرشادات ── */}
      {showHelp && (
        <Modal title="تجهيز زر مقيم في Safari" size="sm" onClose={() => setShowHelp(false)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              زر واحد يكفي لكل مؤسساتك، يُحفظ في مفضلة Safari مرة واحدة. افتح هذه الشاشة من Safari
              على الآيفون ثم اتبع الخطوات:
            </p>
            <ol className="space-y-3">
              {[
                <>اضغط <span className="font-semibold text-gray-700">«نسخ زر مقيم الموحّد»</span></>,
                <>في Safari اضغط زر المشاركة ثم{' '}
                  <span className="font-semibold text-gray-700">إضافة إشارة مرجعية</span>{' '}
                  وسمِّها <span className="font-semibold text-gray-700">«تعبئة مقيم»</span></>,
                <>افتح المفضلة، اضغط مطولاً على «تعبئة مقيم» واختر{' '}
                  <span className="font-semibold text-gray-700">تحرير</span>، ثم امسح العنوان
                  والصق الرابط المنسوخ مكانه واحفظ</>,
                <>عند الاستخدام: اضغط <span className="font-semibold text-gray-700">«فتح مقيم»</span>،
                  ومن شاشة المتصفح اضغط أيقونة{' '}
                  <span className="font-semibold text-gray-700">فتح في Safari</span>،
                  ثم افتح المفضلة واضغط «تعبئة مقيم»</>,
                <>تظهر قائمة بحث: اكتب اسم المؤسسة واخترها —{' '}
                  <span className="font-semibold text-gray-700">تتعبأ البيانات تلقائياً</span></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700
                                   flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-gray-400 leading-relaxed bg-amber-50 rounded-xl px-3 py-2">
              ملاحظة: الزر يحمل بيانات كل المؤسسات. عند إضافة مؤسسة أو تغيير كلمة مرور، أعد نسخ الزر
              والصقه مكان القديم (مرة واحدة، لا لكل مؤسسة).
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
