import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import MobileScreenHeader from '../components/MobileScreenHeader'
import Modal from '../components/Modal'
import { apiFetch } from '../lib/api'
import { useNotifications, isIqamaExpired } from '../hooks/useNotifications'
import type { MonthlyPaymentAlert } from '../hooks/useNotifications'

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

  const rows = notifs?.monthlyPayments ?? []

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

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold">لا توجد دفعات مستحقة</p>
            <p className="text-xs text-gray-400 mt-1">كل الدفعات الشهرية القريبة مسدّدة</p>
          </div>
        ) : (
          rows.map((m) => {
            const overdue = isOverdue(m.receivedDate)
            const iqamaExpired = isIqamaExpired(m.client?.iqamaEndDate)
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {m.client?.name ?? '—'}
                    </p>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {iqamaExpired && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                                         bg-red-100 text-red-700 ring-1 ring-red-200">
                          إقامة منتهية
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        overdue ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700'
                      }`}>
                        {overdue ? 'مستحقة' : 'قريبة'}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    <span>الاستحقاق: {fmtDate(m.receivedDate)}</span>
                    <span className="font-semibold text-gray-700">المبلغ: {fmt(m.amount)}</span>
                    {m.client?.organization?.name && (
                      <span className="col-span-2 truncate">{m.client.organization.name}</span>
                    )}
                  </div>
                  {m.carriedOverAmount != null && m.carriedOverAmount > 0 && (
                    <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                      تشمل مبلغاً مرحّلاً ({fmt(m.carriedOverAmount)}) من دفعية سابقة
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openPay(m)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100
                             text-sm font-semibold text-violet-600 active:bg-violet-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  تسديد
                </button>
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
