import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface MonthlyPayment {
  id: number
  month: string | null
  receivedDate: string | null
  amount: number | null
  receivedAmount: number | null
  status: string | null
  notes: string | null
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString('ar-SA') : '—'
}

/**
 * لوحة الدفعيات الشهرية: تسديد الدفعية المستحقة مع ترحيل الفرق للدفعية
 * القادمة عند إدخال مبلغ أقل، وعرض سجل الدفعيات.
 */
export default function MonthlyPaymentsPanel({
  clientId, monthlyAmount,
}: { clientId: number; monthlyAmount: number | null }) {
  const qc = useQueryClient()

  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [carryOverAck, setCarryOverAck] = useState(false)
  const [newDueDate, setNewDueDate] = useState('')
  const [newAmount, setNewAmount] = useState(monthlyAmount != null ? String(monthlyAmount) : '')

  const { data: monthlies = [], isLoading } = useQuery<MonthlyPayment[]>({
    queryKey: ['client-payment-monthlies', clientId],
    queryFn: () => apiFetch<MonthlyPayment[]>(`/api/client-payment-monthlies?clientId=${clientId}`),
  })

  // الدفعية المستحقة = أقدم دفعية غير مسدّدة
  const dueRecord = [...monthlies]
    .filter((m) => m.status !== 'paid')
    .sort((a, b) => (a.receivedDate ?? '').localeCompare(b.receivedDate ?? ''))[0]

  const due = dueRecord?.amount ?? 0
  const entered = Number(payAmount)
  const shortfall = payAmount && entered > 0 && entered < due ? due - entered : 0

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['client-payment-monthlies', clientId] })
    qc.invalidateQueries({ queryKey: ['client', clientId] })
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const payInstallment = useMutation({
    mutationFn: (body: { receivedAmount: number; notes?: string }) =>
      apiFetch<unknown>(`/api/client-payment-monthlies/${dueRecord!.id}/pay`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidateAll()
      setPayAmount(''); setPayNotes(''); setCarryOverAck(false)
    },
  })

  const createInstallment = useMutation({
    mutationFn: (body: { clientId: number; month: string; receivedDate: string; amount: number; status: string }) =>
      apiFetch<unknown>('/api/client-payment-monthlies', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateAll()
      setNewDueDate('')
    },
  })

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!dueRecord || !payAmount || entered <= 0 || entered > due) return
    if (shortfall > 0 && !carryOverAck) return
    payInstallment.mutate({ receivedAmount: entered, notes: payNotes || undefined })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newDueDate || !newAmount || Number(newAmount) <= 0) return
    createInstallment.mutate({
      clientId,
      month: newDueDate.slice(0, 7),
      receivedDate: newDueDate,
      amount: Number(newAmount),
      status: 'un-paid',
    })
  }

  return (
    <div>
      {/* ── تسديد الدفعية المستحقة ── */}
      {dueRecord ? (
        <form onSubmit={handlePay} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-3">
            تسديد الدفعية المستحقة — المبلغ: {fmt(due)} ر.س
            {dueRecord.receivedDate && ` (تاريخ الاستحقاق: ${dueRecord.receivedDate.slice(0, 10)})`}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>المبلغ المستلم (ر.س)</label>
              <input type="number" min={1} max={due} value={payAmount}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setPayAmount(val > due ? String(due) : e.target.value)
                  setCarryOverAck(false)
                }}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ملاحظات</label>
              <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                placeholder="ملاحظات اختيارية" className={inputCls} />
            </div>
          </div>

          {shortfall > 0 && (
            <label className="flex items-start gap-2.5 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={carryOverAck}
                onChange={(e) => setCarryOverAck(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-amber-600" />
              <span className="text-xs text-amber-800 leading-relaxed">
                المبلغ المدخل أقل من مبلغ الدفعية ({fmt(due)} ر.س)، وسيتم ترحيل الفرق
                <span className="font-bold"> {fmt(shortfall)} ر.س </span>
                وإضافته إلى الدفعية القادمة.
              </span>
            </label>
          )}

          <button type="submit"
            disabled={
              payInstallment.isPending || !payAmount || entered <= 0 || entered > due ||
              (shortfall > 0 && !carryOverAck)
            }
            className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                       text-white text-sm font-semibold px-8 py-2.5 transition-colors">
            {payInstallment.isPending ? '...' : 'تسديد'}
          </button>
          {payInstallment.isError && (
            <p className="text-xs text-red-600 mt-2">
              {payInstallment.error instanceof Error ? payInstallment.error.message : 'حدث خطأ'}
            </p>
          )}
        </form>
      ) : (
        !isLoading && (
          <form onSubmit={handleCreate} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-3">
              لا توجد دفعية مستحقة — إضافة دفعية جديدة
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>تاريخ الاستحقاق</label>
                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>مبلغ الدفعية (ر.س)</label>
                <input type="number" min={1} value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)} className={inputCls} />
              </div>
            </div>
            <button type="submit"
              disabled={createInstallment.isPending || !newDueDate || !newAmount || Number(newAmount) <= 0}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-sm font-semibold px-8 py-2.5 transition-colors">
              {createInstallment.isPending ? '...' : 'إضافة'}
            </button>
            {createInstallment.isError && (
              <p className="text-xs text-red-600 mt-2">
                {createInstallment.error instanceof Error ? createInstallment.error.message : 'حدث خطأ'}
              </p>
            )}
          </form>
        )
      )}

      {/* ── سجل الدفعيات الشهرية ── */}
      <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-600 text-white text-right">
              <th className="px-4 py-3 text-xs font-semibold">الشهر</th>
              <th className="px-4 py-3 text-xs font-semibold">تاريخ الاستحقاق</th>
              <th className="px-4 py-3 text-xs font-semibold">المبلغ</th>
              <th className="px-4 py-3 text-xs font-semibold">المستلم</th>
              <th className="px-4 py-3 text-xs font-semibold">الحالة</th>
              <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  جارٍ التحميل...
                </td>
              </tr>
            ) : monthlies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  لا توجد دفعيات شهرية مسجلة
                </td>
              </tr>
            ) : (
              monthlies.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{m.month ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.receivedDate ? m.receivedDate.slice(0, 10) : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmt(m.amount)}</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(m.receivedAmount)}</td>
                  <td className="px-4 py-3">
                    {m.status === 'paid' ? (
                      <span className="inline-flex rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                        مسدّدة
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold">
                        مستحقة
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.notes ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
