import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import { apiFetch } from '../lib/api'
import { buildCredsFillBookmarklet } from '../lib/bookmarklet'
import {
  useLoginPlatforms,
  useCredentialSummaries,
} from '../hooks/useLoginPlatforms'

interface OrgLite {
  id: number
  name: string | null
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 min-h-9
                  transition-colors ${
        copied
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-sky-50 text-sky-700 active:bg-sky-100'
      }`}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {copied ? 'تم النسخ' : `نسخ ${label}`}
    </button>
  )
}

/**
 * شاشة منصة مقيم المخصصة (PWA): لكل مؤسسة كرت بزرّين.
 *   «نسخ زر مقيم» يجهّز زراً سحرياً يحمل بيانات هذه المؤسسة **مضمّنة** بداخله
 *   (يُحفظ في مفضلة Safari مرة واحدة) — يتجاوز حجب CSP في مقيم لأنه لا يتصل بأي خادم.
 *   «فتح مقيم» يفتح الموقع، ولا يُفعَّل إلا بعد تجهيز زر المؤسسة (إرشاد للترتيب الصحيح).
 * التعبئة الفعلية تحدث من الزر المحفوظ في Safari على صفحة الدخول، لا من هذه الشاشة.
 */
export default function MobileMuqeemPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // المؤسسة التي نُسخ زرها في هذه الجلسة — يفتح قفل «فتح مقيم» لها وحدها
  const [preparedOrgId, setPreparedOrgId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const { data: platforms = [] } = useLoginPlatforms()
  const { data: summaries = [], isLoading: summariesLoading } = useCredentialSummaries()
  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgLite[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgLite[]>('/api/organizations'),
  })

  const muqeem = platforms.find((p) => p.key === 'muqeem')

  // المؤسسات التي سجلت بيانات دخولها على مقيم فقط — البقية لا فائدة من عرضها هنا
  const orgsWithCreds = orgs.filter((org) =>
    summaries.some((s) => s.organizationId === org.id && s.platform === 'muqeem'),
  )

  // كلمة المرور تُجلب عند اختيار المؤسسة فقط ولا تبقى في الكاش
  const { data: creds, isLoading: credsLoading } = useQuery<{ username: string; password: string }>({
    queryKey: ['mobile-muqeem-creds', selectedOrgId],
    queryFn: () => apiFetch(`/api/org-credentials/${selectedOrgId}/muqeem`),
    enabled: selectedOrgId !== null,
    staleTime: 0,
    gcTime: 0,
  })

  const isLoading = orgsLoading || summariesLoading

  // يبني زر المؤسسة (ببياناتها مضمّنة) وينسخه للحافظة لحفظه في مفضلة Safari
  async function copyOrgButton() {
    if (!creds || selectedOrgId === null) return
    await navigator.clipboard.writeText(
      buildCredsFillBookmarklet(creds.username, creds.password),
    )
    setPreparedOrgId(selectedOrgId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="منصة مقيم" accent="bg-sky-500" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-4 pb-10">
        <div className="flex items-start justify-between gap-2 px-1">
          <p className="flex-1 text-xs text-gray-500 leading-relaxed">
            اختر المؤسسة، اضغط «نسخ زر مقيم» واحفظه في مفضلة Safari مرة واحدة، ثم «فتح مقيم».
            على صفحة الدخول اضغط زر المؤسسة من المفضلة لتعبئة البيانات.
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

        {/* ── كروت المؤسسات ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : orgsWithCreds.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-500">
              لا توجد مؤسسات مسجلة بياناتها على مقيم — سجلها من الملف الشخصي في النسخة الكاملة
            </p>
          ) : (
            orgsWithCreds.map((org) => {
              const selected = org.id === selectedOrgId
              const prepared = preparedOrgId === org.id
              return (
                <div key={org.id} className="border-b border-gray-50 last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(selected ? null : org.id)
                      setShowPassword(false)
                    }}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-start transition-colors ${
                      selected ? 'bg-sky-50/70' : 'active:bg-gray-50'
                    }`}
                  >
                    <span className={`w-1.5 h-9 rounded-full shrink-0 transition-colors
                                      ${selected ? 'bg-sky-500' : 'bg-gray-200'}`} />
                    <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">
                      {org.name ?? '—'}
                    </span>
                    {prepared && !selected && (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50
                                       rounded-full px-2 py-0.5">
                        جاهز
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${selected ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* ── محتوى الكرت عند الاختيار ── */}
                  {selected && (
                    <div className="px-4 pb-4 pt-1 bg-sky-50/30 space-y-3">
                      {credsLoading ? (
                        <div className="space-y-3">
                          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                        </div>
                      ) : creds ? (
                        <>
                          {/* اسم المستخدم (احتياطي للّصق اليدوي) */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0 rounded-xl bg-white border border-gray-200 px-3 py-2.5">
                              <p className="text-[10px] text-gray-400 mb-0.5">اسم المستخدم</p>
                              <p className="text-sm font-mono text-gray-800 truncate" dir="ltr">{creds.username}</p>
                            </div>
                            <CopyButton value={creds.username} label="الاسم" />
                          </div>

                          {/* كلمة المرور (احتياطي للّصق اليدوي) */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0 rounded-xl bg-white border border-gray-200 px-3 py-2.5">
                              <p className="text-[10px] text-gray-400 mb-0.5">كلمة المرور</p>
                              <div className="flex items-center gap-2" dir="ltr">
                                <p className="flex-1 text-sm font-mono text-gray-800 truncate">
                                  {showPassword ? creds.password : '••••••••'}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                  className="text-gray-400 active:text-gray-600 shrink-0"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    {showPassword ? (
                                      <path strokeLinecap="round" strokeLinejoin="round"
                                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    ) : (
                                      <>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </>
                                    )}
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <CopyButton value={creds.password} label="الكلمة" />
                          </div>

                          {/* ── الزرّان ── */}
                          <div className="pt-1 space-y-2">
                            {/* 1) تجهيز زر المؤسسة */}
                            <button
                              type="button"
                              onClick={copyOrgButton}
                              className={`flex items-center justify-center gap-2 w-full rounded-xl
                                          text-sm font-semibold py-3 min-h-12 shadow-sm transition-colors ${
                                copied
                                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                  : 'bg-sky-500 active:bg-sky-600 text-white shadow-sky-500/20'
                              }`}
                            >
                              {copied ? (
                                <>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  تم نسخ زر المؤسسة
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  نسخ زر مقيم
                                </>
                              )}
                            </button>

                            {/* 2) فتح مقيم — مقفول حتى تجهيز الزر */}
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
                                    اضغط «نسخ زر مقيم» أولاً لتفعيل الفتح
                                  </p>
                                </>
                              )
                            ) : (
                              <p className="text-center text-sm text-gray-400 py-2">
                                رابط منصة مقيم غير مضبوط — اضبطه من الملف الشخصي في النسخة الكاملة
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="py-6 text-center text-sm text-gray-500">تعذّر جلب بيانات الدخول</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* ── نافذة الإرشادات ── */}
      {showHelp && (
        <Modal title="تجهيز زر مقيم في Safari" size="sm" onClose={() => setShowHelp(false)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              لكل مؤسسة زرها الخاص يُحفظ في مفضلة Safari مرة واحدة. افتح هذه الشاشة من Safari
              على الآيفون ثم اتبع الخطوات لكل مؤسسة تستخدمها:
            </p>
            <ol className="space-y-3">
              {[
                <>اختر المؤسسة واضغط <span className="font-semibold text-gray-700">«نسخ زر مقيم»</span></>,
                <>في Safari اضغط زر المشاركة ثم{' '}
                  <span className="font-semibold text-gray-700">إضافة إشارة مرجعية</span>{' '}
                  وسمِّها باسم المؤسسة (مثل <span className="font-semibold text-gray-700">«مقيم - اسم المؤسسة»</span>)</>,
                <>افتح المفضلة، اضغط مطولاً على الإشارة واختر{' '}
                  <span className="font-semibold text-gray-700">تحرير</span>، ثم امسح العنوان
                  والصق الرابط المنسوخ مكانه واحفظ</>,
                <>عند الاستخدام: اضغط <span className="font-semibold text-gray-700">«فتح مقيم»</span>،
                  ومن شاشة المتصفح اضغط أيقونة{' '}
                  <span className="font-semibold text-gray-700">فتح في Safari</span>،
                  ثم افتح المفضلة واضغط زر المؤسسة — تتعبأ البيانات تلقائياً</>,
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
              ملاحظة: كل زر يحمل بيانات مؤسسته. عند تغيير كلمة مرور مؤسسة، أعد نسخ زرها وحفظه.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
