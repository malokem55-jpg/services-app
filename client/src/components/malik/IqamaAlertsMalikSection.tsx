import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { apiFetch } from '../../lib/api'
import { useNotifications } from '../../hooks/useNotifications'
import type { IqamaAlert } from '../../hooks/useNotifications'

// نسخة «عملاء تنبيهات الإقامات» داخل لوحة malik — للعرض فقط (تعتمد على تسجيل
// دخول المستخدم في نفس المتصفح). تضيف عمود «الدفعيات» يفتح عرضًا للقراءة فقط.

type FilterKey = 'all' | 'expired' | 'soon'

interface AlertRow extends IqamaAlert {
  kind: 'expired' | 'soon'
}

// تفاصيل العميل المطلوبة لعرض الدفعيات (للقراءة فقط)
interface PaymentRow {
  id: number
  amount: number | null
  isDone: boolean | null
  notes: string | null
  createdAt: string | null
}
interface MonthlyRow {
  id: number
  month: string | null
  receivedDate: string | null
  amount: number | null
  receivedAmount: number | null
  status: string | null
  notes: string | null
}
interface ClientDetail {
  id: number
  name: string | null
  paymentType: string | null
  amount: number | null
  payments: PaymentRow[]
  paymentMonthlies: MonthlyRow[]
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function fmtNum(n: number | null | undefined): string {
  return n != null ? n.toLocaleString('en-US') : '—'
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

export default function IqamaAlertsMalikSection() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [paymentsId, setPaymentsId] = useState<number | null>(null)

  const { data: notifs, isLoading, isError, error } = useNotifications()

  // القائمتان منفصلتان زمنياً في السيرفر فلا تكرار بينهما
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

  const FILTERS: { key: FilterKey; label: string; count: number; activeCls: string }[] = [
    { key: 'all', label: 'الكل', count: expiredCount + soonCount, activeCls: 'bg-sky-600 text-white border-sky-600' },
    { key: 'expired', label: 'اقامات منتهية', count: expiredCount, activeCls: 'bg-red-500 text-white border-red-500' },
    { key: 'soon', label: 'اقامات قبل 30 يوم', count: soonCount, activeCls: 'bg-amber-500 text-white border-amber-500' },
  ]

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-5 page-enter">
      {/* ── ترويسة القسم ── */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">عملاء تنبيهات الإقامات</h2>
        {!isLoading && !isError && (
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} عميل</p>
        )}
      </div>

      {/* ── أزرار الفلترة ── */}
      <div className="flex flex-wrap gap-2 mb-4">
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
          تعذّر تحميل التنبيهات. هذه الصفحة تتطلب تسجيل دخول المستخدم في نفس المتصفح.
          {error instanceof Error && <span className="block text-xs text-red-500 mt-1">{error.message}</span>}
        </div>
      )}

      {/* ── الهاتف: بطاقات ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
            </div>
          ))
        ) : rows.length === 0 && !isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500 font-medium">لا يوجد عملاء في هذا التنبيه</p>
          </div>
        ) : (
          rows.map((c) => (
            <div key={`${c.kind}-${c.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
              <div className="border-t border-gray-100">
                <button
                  onClick={() => setPaymentsId(c.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                             text-sky-600 hover:bg-sky-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  </svg>
                  الدفعيات
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── سطح المكتب: جدول ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-100 bg-sky-50 text-right">
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم العميل</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم الإقامة</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">تاريخ الانتهاء</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">المؤسسة</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">طريقة الدفع</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">الحالة</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">الدفعيات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {[40, 28, 24, 24, 16, 16, 14].map((w, j) => (
                      <td key={j} className="px-4 py-2.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 3}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500 font-medium">
                    لا يوجد عملاء في هذا التنبيه
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={`${c.kind}-${c.id}`} className="border-b border-gray-100 hover:bg-sky-50/40 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{c.name ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">{c.iqamaNumber ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{fmtDate(c.iqamaEndDate)}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{c.organization?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.paymentType ?? '—'}</td>
                    <td className="px-4 py-2.5"><KindBadge kind={c.kind} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => setPaymentsId(c.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-700
                                   bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
                      >
                        الدفعيات
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── نافذة الدفعيات (للقراءة فقط) ── */}
      {paymentsId !== null && (
        <PaymentsViewModal clientId={paymentsId} onClose={() => setPaymentsId(null)} />
      )}
    </main>
  )
}

// عرض دفعيات العميل للقراءة فقط: شهري (جدول الأقساط) أو سنوي (الدفعات)
function PaymentsViewModal({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const { data: client, isLoading } = useQuery<ClientDetail>({
    queryKey: ['client', clientId],
    queryFn: () => apiFetch<ClientDetail>(`/api/clients/${clientId}`),
  })

  const isMonthly = client?.paymentType === 'شهري'

  return (
    <Modal title={isMonthly ? 'الدفعيات الشهرية' : 'الدفعيات السنوية'} size={isMonthly ? 'xl' : 'lg'} onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : !client ? (
        <p className="py-10 text-center text-sm text-gray-400">تعذّر تحميل بيانات العميل</p>
      ) : isMonthly ? (
        <MonthlyView rows={client.paymentMonthlies} />
      ) : (
        <AnnualView client={client} />
      )}

      <div className="mt-5 pt-4 border-t border-gray-100">
        <button onClick={onClose}
          className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                     text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
          إغلاق
        </button>
      </div>
    </Modal>
  )
}

function MonthlyView({ rows }: { rows: MonthlyRow[] }) {
  const sorted = [...rows].sort((a, b) =>
    (a.receivedDate ?? '9999').localeCompare(b.receivedDate ?? '9999'))
  const totalDue = sorted.reduce((s, m) => s + (m.amount ?? 0), 0)
  const totalReceived = sorted.reduce((s, m) => s + (m.receivedAmount ?? 0), 0)
  const remaining = totalDue - totalReceived

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المستحق</p>
          <p className="text-base font-bold text-gray-900">{fmtNum(totalDue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المستلم</p>
          <p className="text-base font-bold text-emerald-600">{fmtNum(totalReceived)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المتبقي</p>
          <p className="text-base font-bold text-sky-700">{fmtNum(remaining)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[560px] sm:min-w-0 text-sm">
          <thead>
            <tr className="bg-sky-600 text-white text-right">
              <th className="px-3 py-3 text-xs font-semibold">الشهر</th>
              <th className="px-3 py-3 text-xs font-semibold">تاريخ الاستلام</th>
              <th className="px-3 py-3 text-xs font-semibold">المبلغ</th>
              <th className="px-3 py-3 text-xs font-semibold">المبلغ المستلم</th>
              <th className="px-3 py-3 text-xs font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  لا توجد دفعيات شهرية مسجلة
                </td>
              </tr>
            ) : (
              sorted.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-700">{m.month ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{fmtDate(m.receivedDate)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900">{fmtNum(m.amount)}</td>
                  <td className="px-3 py-3 text-gray-700">{fmtNum(m.receivedAmount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {m.status === 'paid' ? (
                      <span className="inline-flex rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                        تم الدفع
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold">
                        لم يتم الدفع
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnnualView({ client }: { client: ClientDetail }) {
  const paidAmount = client.payments
    .filter((p) => p.isDone)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const remaining = (client.amount ?? 0) - paidAmount

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المدفوع</p>
          <p className="text-base font-bold text-emerald-600">{fmtNum(paidAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
          <p className="text-base font-bold text-sky-700">{fmtNum(remaining)}</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-600 text-white text-right">
              <th className="px-4 py-3 text-xs font-semibold">المبلغ</th>
              <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
              <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {client.payments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                  لا توجد دفعات مسجلة
                </td>
              </tr>
            ) : (
              client.payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmtNum(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.notes ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
