import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import HijriDateInput from '../components/HijriDateInput'
import MonthlyPaymentsPanel from '../components/MonthlyPaymentsPanel'
import ClientCardIssuancesModal from '../components/ClientCardIssuancesModal'
import { apiFetch } from '../lib/api'
import { formatBothDates } from '../lib/hijri'
import { useNotifications } from '../hooks/useNotifications'
import type { IqamaAlert } from '../hooks/useNotifications'

type FilterKey = 'all' | 'expired' | 'soon'

interface AlertRow extends IqamaAlert {
  kind: 'expired' | 'soon'
}

interface ClientDetail {
  id: number
  name: string | null
  phone: string | null
  passport: string | null
  boardNumber: string | null
  visaNumber: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  cardType: string | null
  paymentType: string | null
  amount: number | null
  monthlyReceiptDay: number | null
  nextPaymentDate: string | null
  service: { id: number; name: string | null } | null
  organization: { id: number; name: string | null } | null
  arrivalPlace: { id: number; name: string } | null
  payments: Array<{
    id: number
    amount: number | null
    isDone: boolean | null
    nextPaymentDate: string | null
    notes: string | null
    createdAt: string | null
  }>
  paymentMonthlies: Array<{
    id: number
    receivedDate: string | null
    status: string | null
  }>
}

const fldCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function KindBadge({ kind }: { kind: AlertRow['kind'] }) {
  return kind === 'expired' ? (
    <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold">
      إقامة منتهية
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
      قبل 30 يوم
    </span>
  )
}

export default function IqamaAlertsClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [modalView, setModalView] = useState<'detail' | 'payments'>('detail')
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [deletePayId, setDeletePayId] = useState<number | null>(null)
  const [showCards, setShowCards] = useState(false)
  const [renewalId, setRenewalId] = useState<number | null>(null)
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewAmount, setRenewAmount] = useState('')
  const [renewReceivedAmount, setRenewReceivedAmount] = useState('')
  const [renewDayOfMonth, setRenewDayOfMonth] = useState('')
  const [renewNotes, setRenewNotes] = useState('')
  const [renewSubmitAttempted, setRenewSubmitAttempted] = useState(false)

  const { data: notifs, isLoading, isError } = useNotifications()

  // فتح صفحة تفاصيل العميل مع تمرير الصفحة المصدر لتمييزها في الشريط وللرجوع إليها
  function openDetailPage(id: number) {
    navigate(`/clients/${id}`, { state: { from: '/iqama-alerts-clients' } })
  }

  function closeDetail() {
    setDetailId(null)
    setModalView('detail')
    setPayAmount('')
    setPayNotes('')
    setDeletePayId(null)
    setShowCards(false)
  }

  function closeRenewal() {
    setRenewalId(null)
    setRenewEndDate('')
    setRenewAmount('')
    setRenewReceivedAmount('')
    setRenewDayOfMonth('')
    setRenewNotes('')
    setRenewSubmitAttempted(false)
  }

  // القائمتان منفصلتان زمنياً في السيرفر (المنتهية ≤ 7 أيام، والقريبة 7–30 يوم) فلا تكرار بينهما
  const allRows = useMemo<AlertRow[]>(() => {
    const expired = (notifs?.iqamaExpired ?? []).map((c) => ({ ...c, kind: 'expired' as const }))
    const soon = (notifs?.iqamaExpirySoon ?? []).map((c) => ({ ...c, kind: 'soon' as const }))
    return [...expired, ...soon].sort((a, b) =>
      (a.iqamaEndDate ?? '').localeCompare(b.iqamaEndDate ?? ''))
  }, [notifs])

  const expiredCount = notifs?.iqamaExpired.length ?? 0
  const soonCount = notifs?.iqamaExpirySoon.length ?? 0

  const rows = useMemo(() => {
    if (filter === 'expired') return allRows.filter((r) => r.kind === 'expired')
    if (filter === 'soon') return allRows.filter((r) => r.kind === 'soon')
    return allRows
  }, [allRows, filter])

  // تفاصيل العميل المختار — تُجلب عند فتح النافذة فقط
  const { data: detailClient, isLoading: detailLoading } = useQuery<ClientDetail>({
    queryKey: ['client', detailId],
    queryFn: () => apiFetch<ClientDetail>(`/api/clients/${detailId}`),
    enabled: detailId !== null,
  })

  const addPayment = useMutation({
    mutationFn: (body: { clientId: number; amount?: number; isDone: boolean; notes?: string }) =>
      apiFetch<unknown>('/api/client-payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPayAmount('')
      setPayNotes('')
    },
  })

  const deletePayment = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/client-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeletePayId(null)
    },
  })

  function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!detailId) return
    addPayment.mutate({
      clientId: detailId,
      amount: payAmount ? Number(payAmount) : undefined,
      isDone: true,
      notes: payNotes || undefined,
    })
  }

  // نفس منطق التجديد في صفحة العملاء: تحديث التاريخ والمبلغ، وللسنوي تسجيل دفعة مستلمة
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
      // للعميل الشهري: السيرفر يستكمل جدول الدفعيات تلقائياً حتى تاريخ الانتهاء الجديد
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
          body: JSON.stringify({ clientId: body.clientId, amount: body.receivedAmount, isDone: true, notes: body.notes }),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', renewalId] })
      qc.invalidateQueries({ queryKey: ['client-payment-monthlies'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      closeRenewal()
    },
  })

  const renewalClient = renewalId !== null ? allRows.find((r) => r.id === renewalId) : undefined

  function handleRenewIqama(e: React.FormEvent) {
    e.preventDefault()
    setRenewSubmitAttempted(true)
    const isMonthly = renewalClient?.paymentType === 'شهري'
    if (!renewalId || !renewEndDate || !renewAmount) return
    renewIqama.mutate({
      clientId: renewalId,
      iqamaEndDate: renewEndDate,
      amount: Number(renewAmount),
      isMonthly,
      receivedAmount: renewReceivedAmount ? Number(renewReceivedAmount) : undefined,
      dayOfMonth: renewDayOfMonth ? Number(renewDayOfMonth) : undefined,
      notes: renewNotes || undefined,
    })
  }

  const paidAmount = detailClient?.payments
    .filter((p) => p.isDone)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0
  const remaining = (detailClient?.amount ?? 0) - paidAmount
  const isMonthly = detailClient?.paymentType === 'شهري'
  // للعميل الشهري: الدفعة القادمة هي أقرب دفعية مستحقة من جدول الأقساط
  const nextMonthlyDue = (detailClient?.paymentMonthlies ?? [])
    .filter((m) => m.status !== 'paid' && m.receivedDate)
    .map((m) => (m.receivedDate as string).slice(0, 10))
    .sort()[0] ?? null

  const FILTERS: { key: FilterKey; label: string; count: number; activeCls: string }[] = [
    { key: 'all', label: 'الكل', count: expiredCount + soonCount, activeCls: 'bg-sky-600 text-white border-sky-600' },
    { key: 'expired', label: 'اقامات منتهية', count: expiredCount, activeCls: 'bg-red-500 text-white border-red-500' },
    { key: 'soon', label: 'اقامات قبل 30 يوم', count: soonCount, activeCls: 'bg-amber-500 text-white border-amber-500' },
  ]

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-gray-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-4 page-enter
                       md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden">
        {/* ── Page header ── */}
        <div className="mb-4 md:shrink-0">
          <h2 className="text-xl font-bold text-gray-900">عملاء تنبيهات الإقامات</h2>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-0.5">{rows.length} عميل</p>
          )}
        </div>

        {/* ── Filter buttons ── */}
        <div className="flex flex-wrap gap-2 mb-4 md:shrink-0">
          {FILTERS.map(({ key, label, count, activeCls }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 min-h-11 text-sm font-semibold
                          transition-colors ${
                            filter === key
                              ? `${activeCls} shadow-sm`
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
            >
              <span>{label}</span>
              <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full
                                text-[11px] font-bold ${
                                  filter === key ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                                }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {isError && (
          <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل التنبيهات، حاول تحديث الصفحة.
          </div>
        )}

        {/* ── Mobile: card list ── */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">لا يوجد عملاء في هذا التنبيه</p>
            </div>
          ) : (
            rows.map((c) => (
              <div
                key={`${c.kind}-${c.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                           active:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => openDetailPage(c.id)}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{c.name ?? '—'}</p>
                    <KindBadge kind={c.kind} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    {c.iqamaNumber && <span className="font-mono">إقامة: {c.iqamaNumber}</span>}
                    <span>تنتهي: {fmtDate(c.iqamaEndDate)}</span>
                    {c.organization?.name && <span className="truncate">{c.organization.name}</span>}
                    {c.paymentType && <span>دفع {c.paymentType}</span>}
                  </div>
                </div>

                {/* Card actions */}
                <div className="flex border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setDetailId(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                               text-sky-600 hover:bg-sky-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    التفاصيل
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={() => setRenewalId(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                               text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    تجديد الإقامة
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم العميل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم الإقامة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">تاريخ الانتهاء</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">المؤسسة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">طريقة الدفع</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">الحالة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">تجديد الإقامة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {[40, 28, 24, 24, 16, 16, 14, 12].map((w, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 3}px` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">لا يوجد عملاء في هذا التنبيه</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={`${c.kind}-${c.id}`}
                      className="border-b border-gray-100 hover:bg-sky-50/40 cursor-pointer transition-colors"
                      onClick={() => openDetailPage(c.id)}
                    >
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{c.name ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">{c.iqamaNumber ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{fmtDate(c.iqamaEndDate)}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium">{c.organization?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{c.paymentType ?? '—'}</td>
                      <td className="px-4 py-2.5"><KindBadge kind={c.kind} /></td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenewalId(c.id) }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700
                                     bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          تجديد
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.id) }}
                          aria-label="عرض التفاصيل"
                          className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                     hover:bg-sky-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── Detail modal — عملاء هذه الصفحة كلهم مكتملون فتتبع فرع المكتمل ───── */}
      {detailId !== null && modalView === 'detail' && (
        <Modal title="تفاصيل عميل" size="lg" onClose={closeDetail}>
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : detailClient ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 mb-5">
                {[
                  { label: 'اسم العميل', val: detailClient.name },
                  { label: 'رقم الهاتف', val: detailClient.phone },
                  { label: 'المؤسسة', val: detailClient.organization?.name },
                  { label: 'رقم الإقامة', val: detailClient.iqamaNumber },
                  { label: 'تاريخ انتهاء الإقامة', val: formatBothDates(detailClient.iqamaEndDate) },
                  { label: 'كرت العمل', val: detailClient.cardType },
                  { label: 'تاريخ الدفعة القادمة', val: isMonthly ? nextMonthlyDue : detailClient.nextPaymentDate?.slice(0, 10) },
                  { label: 'طريقة الدفع', val: detailClient.paymentType },
                  { label: isMonthly ? 'القسط الشهري' : 'المبلغ الإجمالي', val: detailClient.amount != null ? detailClient.amount.toLocaleString('en-US') : null },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{val ?? '—'}</p>
                  </div>
                ))}
              </div>

              {isMonthly ? (
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">تاريخ الدفعة القادمة</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {nextMonthlyDue ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">يوم الاستلام في الشهر</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {detailClient.monthlyReceiptDay ?? '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">المبلغ المدفوع</p>
                    <p className="text-base font-bold text-emerald-600">{paidAmount.toLocaleString('en-US')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
                    <p className="text-base font-bold text-sky-700">{remaining.toLocaleString('en-US')}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <button onClick={() => setModalView('payments')}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  {isMonthly ? 'الدفعيات' : 'عرض الدفعيات'}
                </button>
                <button onClick={() => setShowCards(true)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  كرت العمل
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button onClick={closeDetail}
                  className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                             text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
                  إغلاق
                </button>
              </div>
            </>
          ) : null}
        </Modal>
      )}

      {/* ─── Payments modal — نفس إدارة الدفعيات الكاملة في صفحة العملاء ──────── */}
      {detailId !== null && modalView === 'payments' && detailClient && (() => {
        const isMonthlyPay = detailClient.paymentType === 'شهري'
        return (
          <Modal title={isMonthlyPay ? 'الدفعيات الشهرية' : 'الدفعيات السنوية'} onClose={closeDetail}
            size={isMonthlyPay ? 'xl' : 'lg'}>
            {isMonthlyPay && (
              <MonthlyPaymentsPanel clientId={detailClient.id} monthlyAmount={detailClient.amount} />
            )}
            {!isMonthlyPay && remaining > 0 && (
              <form onSubmit={handleAddPayment} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-3">
                  تسجيل دفعة (المتبقي: {remaining.toLocaleString('en-US')})
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>المبلغ المستلم</label>
                    <input type="number" min={1} max={remaining} value={payAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val > remaining) setPayAmount(String(remaining))
                        else setPayAmount(e.target.value)
                      }}
                      className={fldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ملاحظات</label>
                    <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className={fldCls} />
                  </div>
                </div>
                <button type="submit"
                  disabled={addPayment.isPending || !payAmount || Number(payAmount) <= 0 || Number(payAmount) > remaining}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                             text-white text-sm font-semibold px-8 py-2.5 transition-colors">
                  {addPayment.isPending ? '...' : 'حفظ'}
                </button>
              </form>
            )}

            {!isMonthlyPay && remaining <= 0 && (
              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center font-medium">
                تم استلام المبلغ الإجمالي كاملاً
              </div>
            )}

            {!isMonthlyPay && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-600 text-white text-right">
                    <th className="px-4 py-3 text-xs font-semibold">المبلغ</th>
                    <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
                    <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {detailClient.payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                        لا توجد دفعات مسجلة
                      </td>
                    </tr>
                  ) : (
                    detailClient.payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {p.amount != null ? p.amount.toLocaleString('en-US') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.createdAt ? p.createdAt.slice(0, 10) : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.notes ?? ''}</td>
                        <td className="px-4 py-3 text-center">
                          {deletePayId === p.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => deletePayment.mutate(p.id)} disabled={deletePayment.isPending}
                                className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                                           rounded-lg px-2.5 py-1.5 transition-colors">
                                {deletePayment.isPending ? '...' : 'نعم'}
                              </button>
                              <button onClick={() => setDeletePayId(null)}
                                className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                                لا
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletePayId(p.id)}
                              className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setModalView('detail')}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
                رجوع
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* ─── Card issuances modal ─────────────────────────────────────────────── */}
      {showCards && detailClient && (
        <ClientCardIssuancesModal
          clientId={detailClient.id}
          organizationId={detailClient.organization?.id ?? null}
          organizationName={detailClient.organization?.name ?? null}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* ─── Renewal modal ────────────────────────────────────────────────────── */}
      {renewalId !== null && (
        <Modal
          title={`تجديد إقامة — ${renewalClient?.name ?? '—'} (${renewalClient?.paymentType ?? '—'})`}
          onClose={closeRenewal}
        >
          <form onSubmit={handleRenewIqama}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="sm:col-span-3">
                <label className={labelCls}>تاريخ انتهاء الإقامة</label>
                <HijriDateInput
                  value={renewEndDate}
                  onChange={setRenewEndDate}
                  defaultMode="hijri"
                  hasError={renewSubmitAttempted && !renewEndDate}
                />
                {renewSubmitAttempted && !renewEndDate && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
              </div>
              <div>
                <label className={labelCls}>المبلغ</label>
                <input type="number" min={0} value={renewAmount} onChange={(e) => setRenewAmount(e.target.value)}
                  className={`${fldCls} ${renewSubmitAttempted && !renewAmount ? 'border-red-400 focus:ring-red-400' : ''}`} />
                {renewSubmitAttempted && !renewAmount && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
              </div>
              {renewalClient?.paymentType === 'شهري' ? (
                <div>
                  <label className={labelCls}>يوم الاستلام من كل شهر</label>
                  <input type="number" min={1} max={31} value={renewDayOfMonth}
                    onChange={(e) => setRenewDayOfMonth(e.target.value)} className={fldCls} />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>المبلغ المستلم</label>
                  <input type="number" min={0} value={renewReceivedAmount}
                    onChange={(e) => setRenewReceivedAmount(e.target.value)} className={fldCls} />
                </div>
              )}
            </div>

            {renewalClient?.paymentType !== 'شهري' && (
              <div className="mb-5">
                <label className={labelCls}>ملاحظات عن الدفعية</label>
                <input type="text" value={renewNotes} onChange={(e) => setRenewNotes(e.target.value)} className={fldCls} />
              </div>
            )}

            {renewIqama.isError && (
              <p className="text-sm text-red-600 mb-4">
                {renewIqama.error instanceof Error ? renewIqama.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={closeRenewal}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium px-5 py-2.5 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={renewIqama.isPending}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                {renewIqama.isPending ? '...' : 'حفظ'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
