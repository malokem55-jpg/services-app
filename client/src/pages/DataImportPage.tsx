import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'

// صفحة مخفية (لا تظهر في أي قائمة تنقّل — الوصول لها بالرابط /data-import فقط):
// رفع ملف MySQL dump للمشروع القديم واستيراده بعد إفراغ بيانات العمل الحالية.

interface ImportResult {
  counts: Record<string, number>
  warnings: string[]
}

const COUNT_LABELS: Record<string, string> = {
  services: 'الخدمات',
  serviceSteps: 'خطوات الخدمات',
  organizations: 'المؤسسات',
  clients: 'العملاء',
  clientSteps: 'خطوات العملاء',
  clientPayments: 'دفعات العملاء',
  clientPaymentMonthlies: 'الدفعات الشهرية',
}

const CONFIRM_WORD = 'استيراد'

export default function DataImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [sqlText, setSqlText] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [readError, setReadError] = useState('')

  const importMutation = useMutation({
    mutationFn: (sql: string) =>
      apiFetch<ImportResult>('/api/data-import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: sql,
      }),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setSqlText('')
    setReadError('')
    setConfirmText('')
    importMutation.reset()
    if (!selected) return
    const reader = new FileReader()
    reader.onload = () => setSqlText(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => setReadError('تعذرت قراءة الملف')
    reader.readAsText(selected, 'utf-8')
  }

  const canImport = sqlText.length > 0 && confirmText.trim() === CONFIRM_WORD && !importMutation.isPending

  function handleImport() {
    if (!canImport) return
    importMutation.mutate(sqlText)
  }

  const result = importMutation.data

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 page-enter">
        <div>
          <h2 className="text-xl font-bold text-gray-900">استيراد بيانات النظام القديم</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            رفع ملف MySQL لقاعدة بيانات المشروع القديم واستيراده إلى هذا النظام
          </p>
        </div>

        {/* تحذير */}
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="text-sm font-bold text-red-700">تحذير: عملية لا يمكن التراجع عنها</h3>
          </div>
          <ul className="text-xs text-red-700 leading-relaxed pr-7 list-disc space-y-0.5">
            <li>سيتم حذف كل بيانات العمل الحالية: العملاء، المؤسسات، الخدمات، الخطوات، الدفعات، الدفعات الشهرية، إصدارات الكروت، ديون المحذوفين، جهات القدوم، وبيانات دخول المؤسسات على المنصات.</li>
            <li>يبقى فقط: حساب المستخدم، وإعدادات النظام (الإشعارات، الواجهة، المنصات).</li>
            <li>ثم تُستورد بيانات الملف المرفوع محل البيانات المحذوفة.</li>
          </ul>
        </div>

        {/* اختيار الملف */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-sky-700">ملف قاعدة البيانات (.sql)</h3>
          </div>
          <div className="p-5 md:p-4 space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                         border-gray-300 hover:border-sky-400 hover:bg-sky-50/50 transition-colors
                         px-4 py-8 cursor-pointer text-center"
            >
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600">
                {file ? file.name : 'اضغط لاختيار ملف SQL'}
              </span>
              {file && (
                <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} م.ب</span>
              )}
              <input type="file" accept=".sql,text/plain" onChange={handleFileChange} className="hidden" />
            </label>

            {readError && <p className="text-sm text-red-600">{readError}</p>}

            {sqlText.length > 0 && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    للتأكيد، اكتب كلمة «{CONFIRM_WORD}» في الحقل التالي
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
                               focus:bg-white transition-colors min-h-11"
                  />
                </div>

                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50
                             disabled:cursor-not-allowed text-white text-sm font-semibold py-3 min-h-11
                             transition-colors shadow-sm shadow-red-600/20"
                >
                  {importMutation.isPending
                    ? 'جارٍ الاستيراد... قد يستغرق ذلك دقيقة'
                    : 'حذف البيانات الحالية واستيراد الملف'}
                </button>
              </>
            )}

            {importMutation.isError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-700">
                  {importMutation.error instanceof Error ? importMutation.error.message : 'حدث خطأ أثناء الاستيراد'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* النتيجة */}
        {result && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 md:py-3 border-b border-gray-100 bg-emerald-50/50">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-emerald-700">تم الاستيراد بنجاح</h3>
            </div>
            <div className="p-5 md:p-4 space-y-4">
              <dl className="space-y-1">
                {Object.entries(result.counts).map(([key, count]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <dt className="text-xs font-medium text-gray-400">{COUNT_LABELS[key] ?? key}</dt>
                    <dd className="text-sm font-semibold text-gray-800">{count}</dd>
                  </div>
                ))}
              </dl>

              {result.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700">ملاحظات ({result.warnings.length})</p>
                  <ul className="text-xs text-amber-700 leading-relaxed pr-4 list-disc space-y-0.5 max-h-48 overflow-y-auto">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
