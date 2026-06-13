import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import HijriDateInput from '../components/HijriDateInput'
import { apiFetch } from '../lib/api'
import { useNotifications } from '../hooks/useNotifications'

// عميل قابل للتجديد: من تنبيهات الإقامات أو من نتائج البحث — نفس الحقول المطلوبة للنافذة
interface RenewTarget {
  id: number
  name: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  paymentType: string | null
  organizationName: string | null
  kind?: 'expired' | 'soon'
}

interface SearchClient {
  id: number
  name: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  paymentType: string | null
  organization: { name: string | null } | null
}

const fldCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-base focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-12'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '—'
}

/**
 * شاشة تجديد الإقامة المخصصة: تنبيهات الإقامات (منتهية + قبل 30 يوم) مع بحث عن
 * أي عميل بالاسم أو رقم الإقامة، والتجديد بنفس منطق النسخة الكاملة — تحديث
 * التاريخ يمدد جدول الدفعيات الشهرية تلقائياً في السيرفر.
 */
export default function MobileIqamaPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [renewTarget, setRenewTarget] = useState<RenewTarget | null>(null)

  // ── حقول نافذة التجديد (نفس فورم النسخة الكاملة) ──
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewAmount, setRenewAmount] = useState('')
  const [renewReceivedAmount, setRenewReceivedAmount] = useState('')
  const [renewDayOfMonth, setRenewDayOfMonth] = useState('')
  const [renewNotes, setRenewNotes] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const { data: notifs, isLoading, isError } = useNotifications()

  const query = search.trim()
  const searching = query.length >= 2

  const { data: searchResults = [], isFetching: searchLoading } = useQuery<SearchClient[]>({
    queryKey: ['mobile-iqama-search', query],
    queryFn: () => apiFetch<SearchClient[]>(`/api/clients?search=${encodeURIComponent(query)}`),
    enabled: searching,
  })

  const alertRows = useMemo<RenewTarget[]>(() => {
    const expired = (notifs?.iqamaExpired ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      iqamaNumber: c.iqamaNumber,
      iqamaEndDate: c.iqamaEndDate,
      paymentType: c.paymentType,
      organizationName: c.organization?.name ?? null,
      kind: 'expired' as const,
    }))
    const soon = (notifs?.iqamaExpirySoon ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      iqamaNumber: c.iqamaNumber,
      iqamaEndDate: c.iqamaEndDate,
      paymentType: c.paymentType,
      organizationName: c.organization?.name ?? null,
      kind: 'soon' as const,
    }))
    return [...expired, ...soon].sort((a, b) =>
      (a.iqamaEndDate ?? '').localeCompare(b.iqamaEndDate ?? ''))
  }, [notifs])

  const rows: RenewTarget[] = searching
    ? searchResults.map((c) => ({
        id: c.id,
        name: c.name,
        iqamaNumber: c.iqamaNumber,
        iqamaEndDate: c.iqamaEndDate,
        paymentType: c.paymentType,
        organizationName: c.organization?.name ?? null,
      }))
    : alertRows

  function closeRenewal() {
    setRenewTarget(null)
    setRenewEndDate('')
    setRenewAmount('')
    setRenewReceivedAmount('')
    setRenewDayOfMonth('')
    setRenewNotes('')
    setSubmitAttempted(false)
  }

  // نفس منطق التجديد في النسخة الكاملة: تحديث التاريخ والمبلغ،
  // وللسنوي تسجيل دفعة مستلمة اختيارية
  const renewIqama = useMutation({
    mutationFn: async (body: {
      clientId: number
      iqamaEndDate: string
      amount: number
      isMonthly: boolean
      receivedAmount?: number
      dayOfMonth?: number
      notes?: string
    }) => {
      const clientUpdate: Record<string, unknown> = { iqamaEndDate: body.iqamaEndDate, amount: body.amount }
      if (body.isMonthly && body.dayOfMonth) {
        clientUpdate.monthlyReceiptDay = body.dayOfMonth
      }
      await apiFetch<unknown>(`/api/clients/${body.clientId}`, {
        method: 'PUT',
        body: JSON.stringify(clientUpdate),
      })
      if (!body.isMonthly && body.receivedAmount && body.receivedAmount > 0) {
        await apiFetch<unknown>('/api/client-payments', {
          method: 'POST',
          body: JSON.stringify({
            clientId: body.clientId,
            amount: body.receivedAmount,
            isDone: true,
            notes: body.notes,
          }),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client-payment-monthlies'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['mobile-iqama-search'] })
      closeRenewal()
    },
  })

  const isMonthly = renewTarget?.paymentType === 'شهري'

  function handleRenew(e: React.FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!renewTarget || !renewEndDate || !renewAmount) return
    renewIqama.mutate({
      clientId: renewTarget.id,
      iqamaEndDate: renewEndDate,
      amount: Number(renewAmount),
      isMonthly,
      receivedAmount: renewReceivedAmount ? Number(renewReceivedAmount) : undefined,
      dayOfMonth: renewDayOfMonth ? Number(renewDayOfMonth) : undefined,
      notes: renewNotes || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="تجديد إقامة" accent="bg-emerald-500" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-3 pb-10">
        {/* ── البحث ── */}
        <div className="relative">
          <svg
            className="w-4 h-4 text-gray-400 absolute inset-s-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الإقامة..."
            aria-label="بحث عن عميل"
            className={`${fldCls} ps-10 bg-white`}
          />
        </div>

        <p className="text-xs text-gray-400 px-1">
          {searching
            ? searchLoading ? 'جارٍ البحث...' : `${rows.length} نتيجة بحث`
            : 'العملاء بإقامات منتهية أو تنتهي خلال 30 يوماً'}
        </p>

        {isError && !searching && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل التنبيهات، حاول تحديث الصفحة.
          </div>
        )}

        {/* ── القائمة ── */}
        {(isLoading && !searching) || (searching && searchLoading && rows.length === 0) ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">
              {searching ? `لا توجد نتيجة لـ «${query}»` : 'لا توجد إقامات تحتاج تجديداً'}
            </p>
          </div>
        ) : (
          rows.map((c) => (
            <div
              key={`${c.kind ?? 'search'}-${c.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{c.name ?? '—'}</p>
                  {c.kind === 'expired' && (
                    <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold shrink-0">
                      منتهية
                    </span>
                  )}
                  {c.kind === 'soon' && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold shrink-0">
                      قبل 30 يوم
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                  {c.iqamaNumber && <span className="font-mono">إقامة: {c.iqamaNumber}</span>}
                  <span>تنتهي: {fmtDate(c.iqamaEndDate)}</span>
                  {c.organizationName && <span className="truncate">{c.organizationName}</span>}
                  {c.paymentType && <span>دفع {c.paymentType}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewTarget(c)}
                className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100
                           text-sm font-semibold text-emerald-600 active:bg-emerald-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                تجديد الإقامة
              </button>
            </div>
          ))
        )}
      </main>

      {/* ── نافذة التجديد — نفس فورم النسخة الكاملة ── */}
      {renewTarget && (
        <Modal
          title={`تجديد إقامة — ${renewTarget.name ?? '—'} (${renewTarget.paymentType ?? '—'})`}
          onClose={closeRenewal}
        >
          <form onSubmit={handleRenew} className="space-y-4">
            <div>
              <label className={labelCls}>تاريخ انتهاء الإقامة الجديد</label>
              <HijriDateInput
                value={renewEndDate}
                onChange={setRenewEndDate}
                defaultMode="hijri"
                hasError={submitAttempted && !renewEndDate}
              />
              {submitAttempted && !renewEndDate && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isMonthly ? 'القسط الشهري' : 'المبلغ'}</label>
                <input
                  type="number" inputMode="decimal" min={0} value={renewAmount}
                  onChange={(e) => setRenewAmount(e.target.value)}
                  className={`${fldCls} ${submitAttempted && !renewAmount ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
                {submitAttempted && !renewAmount && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
              </div>
              {isMonthly ? (
                <div>
                  <label className={labelCls}>يوم الاستلام من كل شهر</label>
                  <input
                    type="number" inputMode="numeric" min={1} max={31} value={renewDayOfMonth}
                    onChange={(e) => setRenewDayOfMonth(e.target.value)} className={fldCls}
                  />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>المبلغ المستلم</label>
                  <input
                    type="number" inputMode="decimal" min={0} value={renewReceivedAmount}
                    onChange={(e) => setRenewReceivedAmount(e.target.value)} className={fldCls}
                  />
                </div>
              )}
            </div>

            {!isMonthly && (
              <div>
                <label className={labelCls}>ملاحظات عن الدفعية</label>
                <input type="text" value={renewNotes} onChange={(e) => setRenewNotes(e.target.value)} className={fldCls} />
              </div>
            )}

            {renewIqama.isError && (
              <p className="text-sm text-red-600">
                {renewIqama.error instanceof Error ? renewIqama.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button" onClick={closeRenewal}
                className="flex-1 rounded-xl border border-gray-200 bg-white active:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-12 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit" disabled={renewIqama.isPending}
                className="flex-1 rounded-xl bg-emerald-500 active:bg-emerald-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-12 transition-colors"
              >
                {renewIqama.isPending ? 'جارٍ الحفظ...' : 'حفظ التجديد'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
