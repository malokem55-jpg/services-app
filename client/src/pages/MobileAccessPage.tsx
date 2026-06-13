import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import { useUiSettings } from '../hooks/useUiSettings'
import type { UiSettings } from '../hooks/useUiSettings'

// صفحة مخفية (لا تظهر في أي قائمة — الوصول بالرابط /mobile-access فقط):
// مفتاح واحد يتحكم بفتح الموقع على الهاتف. عند تفعيله يعمل الموقع على متصفحات
// الجوال وتطبيق PWA، وعند إيقافه يعمل على الكمبيوتر فقط.

export default function MobileAccessPage() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useUiSettings()

  const mutation = useMutation({
    mutationFn: (patch: Partial<UiSettings>) =>
      apiFetch<UiSettings>('/api/ui-settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => qc.setQueryData(['ui-settings'], data),
  })

  const enabled = settings?.runOnMobile === true

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 page-enter">
        <div>
          <h2 className="text-xl font-bold text-gray-900">تشغيل المشروع على الهاتف</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            تحكّم بفتح الموقع على الأجهزة المحمولة
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-5">
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <label
              className="flex items-center gap-3 px-5 py-4 md:py-3 cursor-pointer
                         hover:bg-gray-50/60 transition-colors"
            >
              <span className={`w-1.5 h-9 md:h-8 rounded-full shrink-0 ${enabled ? 'bg-sky-500' : 'bg-gray-300'}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-800">
                  تشغيل المشروع على الهاتف
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  {enabled
                    ? 'الموقع يعمل على متصفحات الجوال وتطبيق الهاتف'
                    : 'الموقع يعمل على الكمبيوتر فقط، وممنوع على الهاتف'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={enabled}
                disabled={mutation.isPending}
                onChange={(e) => mutation.mutate({ runOnMobile: e.target.checked })}
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
      </main>
    </div>
  )
}
