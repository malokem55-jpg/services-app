import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'
import { apiFetch, BASE_URL } from '../lib/api'
import { buildFillBookmarklet } from '../lib/bookmarklet'
import { useUiSettings } from '../hooks/useUiSettings'
import type { UiSettings } from '../hooks/useUiSettings'

/**
 * قسم إعدادات تطبيق الموبايل (PWA): مفتاح النسخة المخصصة + تجهيز «الزر السحري»
 * لتعبئة بيانات مقيم في Safari على الآيفون. يُعرض في تاب PWA بصفحة الإعدادات
 * وفي شاشة إعدادات النسخة المخصصة نفسها.
 */
export default function PwaSettingsSection() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useUiSettings()
  const [showFillHelp, setShowFillHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: (patch: Partial<UiSettings>) =>
      apiFetch<UiSettings>('/api/ui-settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => qc.setQueryData(['ui-settings'], data),
  })

  const { data: fillKey } = useQuery<{ key: string }>({
    queryKey: ['mobile-fill-key'],
    queryFn: () => apiFetch<{ key: string }>('/api/mobile-fill/key'),
    staleTime: Infinity,
  })

  async function copyBookmarklet() {
    if (!fillKey) return
    await navigator.clipboard.writeText(buildFillBookmarklet(BASE_URL, fillKey.key))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const enabled = settings?.showCustomMobileVersion === true

  return (
    <div className="space-y-5 md:space-y-4">
      {/* ── مفتاح النسخة المخصصة ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">تطبيق الموبايل</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            تخصيص شكل التطبيق المثبت على الهاتف
          </p>
        </div>

        {isLoading ? (
          <div className="p-5">
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <label
            className="flex items-center gap-3 px-5 py-4 md:py-3 cursor-pointer
                       hover:bg-gray-50/60 transition-colors"
          >
            <span className="w-1.5 h-9 md:h-8 rounded-full shrink-0 bg-sky-500" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-800">
                نسخة الموبايل المخصصة
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">
                عند الإيقاف يظهر الموقع الكامل في التطبيق
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={mutation.isPending}
              onChange={(e) => mutation.mutate({ showCustomMobileVersion: e.target.checked })}
              className="w-5 h-5 shrink-0 rounded border-gray-300 text-sky-600
                         focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-50 accent-sky-600"
            />
          </label>
        )}

        {mutation.isError && (
          <p className="px-5 pb-4 text-sm text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : 'تعذّر حفظ التغيير'}
          </p>
        )}
      </div>

      {/* ── الزر السحري لتعبئة مقيم على الآيفون ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">تعبئة مقيم على الآيفون</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            «الزر السحري» يُحفظ في مفضلة Safari مرة واحدة، وبعدها يعبّي بيانات الدخول تلقائياً
          </p>
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">الزر السحري</p>
              <p className="text-xs text-gray-400">يُجهَّز مرة واحدة على الآيفون فقط</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ms-auto">
            <button
              type="button"
              onClick={() => setShowFillHelp(true)}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:text-sky-600
                         text-gray-600 text-xs font-semibold px-3 py-2 transition-colors"
            >
              الإرشادات
            </button>
            <button
              type="button"
              onClick={copyBookmarklet}
              disabled={!fillKey}
              className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3.5 py-2
                          shadow-sm transition-colors disabled:opacity-50 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  تم النسخ
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  نسخ رابط الزر
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── نافذة إرشادات حفظ الزر السحري ── */}
      {showFillHelp && (
        <Modal title="تجهيز الزر السحري في Safari" size="sm" onClose={() => setShowFillHelp(false)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              يُجهَّز مرة واحدة فقط على الآيفون. افتح هذه الصفحة من Safari على الآيفون ثم اتبع الخطوات:
            </p>
            <ol className="space-y-3">
              {[
                <>اضغط زر <span className="font-semibold text-gray-700">«نسخ رابط الزر»</span> هنا</>,
                <>في Safari اضغط زر المشاركة ثم{' '}
                  <span className="font-semibold text-gray-700">إضافة إشارة مرجعية</span>{' '}
                  وسمِّها <span className="font-semibold text-gray-700">تعبئة مقيم</span></>,
                <>افتح المفضلة، اضغط مطولاً على «تعبئة مقيم» واختر{' '}
                  <span className="font-semibold text-gray-700">تحرير</span>، ثم امسح العنوان
                  والصق الرابط المنسوخ مكانه واحفظ</>,
                <>عند الاستخدام: افتح مقيم من التطبيق، ومن شاشة المتصفح اضغط أيقونة{' '}
                  <span className="font-semibold text-gray-700">البوصلة (فتح في Safari)</span>،
                  ثم افتح المفضلة واضغط «تعبئة مقيم» — تتعبأ البيانات تلقائياً</>,
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

            <button
              type="button"
              onClick={copyBookmarklet}
              disabled={!fillKey}
              className={`flex items-center justify-center gap-2 w-full rounded-xl text-sm font-semibold
                          py-2.5 min-h-11 shadow-sm transition-colors disabled:opacity-50 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
              }`}
            >
              {copied ? 'تم النسخ ✓' : 'نسخ رابط الزر'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
