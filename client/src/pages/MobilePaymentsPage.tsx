import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import FilterChip from '../components/FilterChip'
import { apiFetch } from '../lib/api'
import { useNotifications, groupMonthlyPayments } from '../hooks/useNotifications'
import type { MonthlyPaymentAlert } from '../hooks/useNotifications'
import { paymentReminderMessage, groupReminderMessage } from '../lib/paymentReminder'
import { whatsappUrl } from '../lib/whatsapp'

type Filter = 'all' | 'overdue' | 'soon'

const fldCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 text-base focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 min-h-12'

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString('en-US') : '—'
}

function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '—'
}

// مستحقة اليوم أو فات موعدها
function isOverdue(s: string | null): boolean {
  if (!s) return false
  return s.slice(0, 10) <= new Date().toISOString().slice(0, 10)
}

function WaIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/**
 * شاشة الدفعات الشهرية المخصصة: نفس قائمة جرس الدفعات الشهرية (المستحقة وقريبة
 * الاستحقاق) مع تسديد سريع — نافذة بالمبلغ معبأ مسبقاً، وعند مبلغ أقل يظهر
 * تنبيه ترحيل الفرق بنفس منطق النسخة الكاملة.
 */
export default function MobilePaymentsPage() {
  const qc = useQueryClient()
  const { data: notifs, isLoading, isError } = useNotifications()

  const [paying, setPaying] = useState<MonthlyPaymentAlert | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  // تنبيه الترحيل يظهر بعد أول ضغطة تسديد بمبلغ أقل، والثانية تؤكد
  const [carryOverAck, setCarryOverAck] = useState(false)

  // بحث لايف باسم العميل + فلتر الحالة
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // مجموعات العملاء الموسَّعة (عرض الدفعات بالتفصيل) — بمفتاح المجموعة
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allRows = notifs?.monthlyPayments ?? []

  // عدّادات الفلاتر تُحسب من الإجمالي (لا تتأثر بالبحث)
  const overdueCount = allRows.filter((m) => isOverdue(m.receivedDate)).length
  const soonCount = allRows.length - overdueCount

  const q = search.trim().toLowerCase()
  const rows = allRows.filter((m) => {
    if (filter === 'overdue' && !isOverdue(m.receivedDate)) return false
    if (filter === 'soon' && isOverdue(m.receivedDate)) return false
    if (q && !(m.client?.name ?? '').toLowerCase().includes(q)) return false
    return true
  })

  // نجمع الدفعات (بعد الفلترة) حسب العميل: العميل صاحب عدة دفعات يظهر في بطاقة واحدة
  const groups = groupMonthlyPayments(rows)

  function openPay(m: MonthlyPaymentAlert) {
    setPaying(m)
    setAmount(m.amount != null ? String(m.amount) : '')
    setNotes('')
    setCarryOverAck(false)
  }

  function closePay() {
    setPaying(null)
    setAmount('')
    setNotes('')
    setCarryOverAck(false)
  }

  const pay = useMutation({
    mutationFn: (body: { id: number; receivedAmount: number; notes?: string }) =>
      apiFetch(`/api/client-payment-monthlies/${body.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ receivedAmount: body.receivedAmount, notes: body.notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['client-payment-monthlies'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      closePay()
    },
  })

  const due = paying?.amount ?? 0
  const received = Number(amount || '0')
  const shortfall = received > 0 && received < due ? due - received : 0

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!paying || !amount || received <= 0 || received > due) return
    // مبلغ أقل من المستحق: الضغطة الأولى تعرض تنبيه الترحيل فقط
    if (shortfall > 0 && !carryOverAck) {
      setCarryOverAck(true)
      return
    }
    pay.mutate({ id: paying.id, receivedAmount: received, notes: notes || undefined })
  }

  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="تنبيهات الدفعات الشهرية" accent="bg-violet-500" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-3 pb-10">
        {isError && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل الدفعات، حاول تحديث الصفحة.
          </div>
        )}

        {!isLoading && allRows.length > 0 && (
          <div className="space-y-3">
            {/* صندوق البحث باسم العميل */}
            <div className="relative">
              <svg className="absolute top-1/2 -translate-y-1/2 inset-e-3 w-5 h-5 text-gray-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                inputMode="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم العميل…"
                className={`${fldCls} pe-10`}
              />
            </div>

            {/* أزرار الفلتر مع العدد */}
            <div className="flex gap-2">
              <FilterChip label="الكل" count={allRows.length} active={filter === 'all'}
                onClick={() => setFilter('all')}
                activeCls="bg-gray-800 text-white" />
              <FilterChip label="مستحقة" count={overdueCount} active={filter === 'overdue'}
                onClick={() => setFilter('overdue')}
                activeCls="bg-red-500 text-white" />
              <FilterChip label="قريبة" count={soonCount} active={filter === 'soon'}
                onClick={() => setFilter('soon')}
                activeCls="bg-orange-500 text-white" />
            </div>
          </div>
        )}

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          ))
        ) : allRows.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold">لا توجد دفعات مستحقة</p>
            <p className="text-xs text-gray-400 mt-1">كل الدفعات الشهرية القريبة مسدّدة</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-600 font-semibold">لا توجد نتائج</p>
            <p className="text-xs text-gray-400 mt-1">جرّب اسماً آخر أو غيّر الفلتر</p>
          </div>
        ) : (
          groups.map((g) => {
            const single = g.payments.length === 1
            const isOpen = expanded.has(g.key)
            const overdue = g.anyOverdue
            const first = g.payments[0]
            return (
              <div key={g.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {g.client?.name ?? '—'}
                    </p>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {g.iqamaExpired && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                                         bg-red-100 text-red-700 ring-1 ring-red-200">
                          إقامة منتهية
                        </span>
                      )}
                      {!single && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                                         bg-violet-100 text-violet-700">
                          {g.payments.length} دفعات
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {overdue ? 'مستحقة' : 'قريبة'}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    {single ? (
                      <>
                        <span>الاستحقاق: {fmtDate(first.receivedDate)}</span>
                        <span className="font-semibold text-gray-700">المبلغ: {fmt(first.amount)}</span>
                      </>
                    ) : (
                      <>
                        <span>أقرب استحقاق: {fmtDate(g.earliestDueDate)}</span>
                        <span className="font-semibold text-gray-700">الإجمالي: {fmt(g.total)}</span>
                      </>
                    )}
                    {g.client?.organization?.name && (
                      <span className="col-span-2 truncate">{g.client.organization.name}</span>
                    )}
                  </div>
                  {single && first.carriedOverAmount != null && first.carriedOverAmount > 0 && (
                    <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                      تشمل مبلغاً مرحّلاً ({fmt(first.carriedOverAmount)}) من دفعية بتاريخ {fmtDate(first.carriedFromMonth)}
                    </p>
                  )}
                </div>

                {single ? (
                  <div className="flex border-t border-gray-100">
                    {/* زر المحادثة: يفتح واتساب على الجوال مباشرة (wa.me) مع رسالة التذكير معبّأة */}
                    {(() => {
                      const wa = whatsappUrl(first.client?.phone, paymentReminderMessage(first))
                      if (!wa) return null
                      return (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 border-e border-gray-100
                                     text-sm font-semibold text-emerald-600 active:bg-emerald-50 transition-colors"
                        >
                          <WaIcon />
                          محادثة
                        </a>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={() => openPay(first)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3
                                 text-sm font-semibold text-violet-600 active:bg-violet-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      تسديد
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex border-t border-gray-100">
                      {/* محادثة برسالة مجمَّعة تسرد كل دفعات العميل */}
                      {(() => {
                        const wa = whatsappUrl(g.client?.phone, groupReminderMessage(g.payments))
                        if (!wa) return null
                        return (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 border-e border-gray-100
                                       text-sm font-semibold text-emerald-600 active:bg-emerald-50 transition-colors"
                          >
                            <WaIcon />
                            محادثة
                          </a>
                        )
                      })()}
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3
                                   text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors"
                      >
                        {isOpen ? 'إخفاء الدفعات' : 'عرض الدفعات'}
                        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
                        {g.payments.map((p) => {
                          const pOverdue = isOverdue(p.receivedDate)
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                              <div className="text-xs text-gray-600 min-w-0">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className={pOverdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                                    {fmtDate(p.receivedDate)}
                                  </span>
                                  <span className="text-gray-300">·</span>
                                  <span className="font-semibold text-gray-800">{fmt(p.amount)} ريال</span>
                                </span>
                                {p.carriedOverAmount != null && p.carriedOverAmount > 0 && (
                                  <span className="block text-[10px] text-amber-600 mt-0.5">
                                    تشمل {fmt(p.carriedOverAmount)} مرحّلة من {fmtDate(p.carriedFromMonth)}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => openPay(p)}
                                className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5
                                           text-xs font-semibold text-violet-600 bg-violet-50 active:bg-violet-100 transition-colors"
                              >
                                تسديد
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* ── نافذة التسديد السريع ── */}
      {paying && (
        <Modal title={`تسديد — ${paying.client?.name ?? '—'}`} onClose={closePay}>
          <form onSubmit={handlePay} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3 text-center">
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">المبلغ المستحق</p>
                <p className="text-base font-bold text-gray-900">{fmt(paying.amount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">تاريخ الاستحقاق</p>
                <p className="text-base font-bold text-gray-900">{fmtDate(paying.receivedDate)}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">المبلغ المستلم</label>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={due}
                value={amount}
                autoFocus
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setAmount(val > due ? String(due) : e.target.value)
                  setCarryOverAck(false)
                }}
                className={fldCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">ملاحظات (اختياري)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={fldCls} />
            </div>

            {shortfall > 0 && carryOverAck && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                المبلغ أقل من المستحق — سيُرحَّل الفرق ({fmt(shortfall)}) إلى الدفعية القادمة.
                اضغط «تأكيد التسديد» للمتابعة.
              </div>
            )}

            {pay.isError && (
              <p className="text-sm text-red-600">
                {pay.error instanceof Error ? pay.error.message : 'تعذّر تسجيل التسديد'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closePay}
                className="flex-1 rounded-xl border border-gray-200 bg-white active:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-12 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={pay.isPending || !amount || received <= 0 || received > due}
                className="flex-1 rounded-xl bg-violet-500 active:bg-violet-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-12 transition-colors"
              >
                {pay.isPending ? 'جارٍ الحفظ...' : shortfall > 0 && carryOverAck ? 'تأكيد التسديد' : 'تسديد'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
