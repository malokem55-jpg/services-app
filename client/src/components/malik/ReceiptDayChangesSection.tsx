import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

// قسم «تغييرات يوم الاستلام» داخل لوحة malik:
// يعرض أسماء آخر 20 عميلًا تغيّر لهم يوم الاستلام في الدفعيات الشهرية.

interface ReceiptDayChange {
  id: number
  clientName: string | null
  oldDay: number | null
  newDay: number
  changedAt: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ar-EG-u-ca-gregory', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ReceiptDayChangesSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['malik', 'receipt-day-changes'],
    queryFn: () => apiFetch<ReceiptDayChange[]>('/api/malik/receipt-day-changes'),
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 page-enter">
      <div>
        <h2 className="text-xl font-bold text-gray-900">تغييرات يوم الاستلام</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          أسماء آخر 20 عميلًا تغيّر لهم يوم الاستلام في الدفعيات الشهرية
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-10 text-sm text-gray-400 shadow-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          جارٍ التحميل...
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'حدث خطأ أثناء التحميل'}
          </p>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white py-10 text-center text-sm text-gray-400 shadow-sm">
          لا توجد تغييرات مسجّلة بعد
        </div>
      )}

      {data && data.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {data.map((c) => (
              <li key={c.id} className="px-5 py-3.5 md:py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {c.clientName || 'بدون اسم'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.changedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-sm font-semibold">
                  <span className="rounded-lg bg-gray-100 text-gray-500 px-2 py-1 tabular-nums">
                    {c.oldDay ?? '—'}
                  </span>
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  <span className="rounded-lg bg-sky-50 text-sky-700 px-2 py-1 tabular-nums">
                    {c.newDay}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
