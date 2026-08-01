import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors min-h-11'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

/**
 * تسجيل دفعة لعميل سنوي: المبلغ المستلم وملاحظات وتاريخ الدفعة القادمة.
 * تاريخ الدفعة القادمة على بطاقة العميل هو مصدر تنبيهات الدفع، فيُحدَّث معه
 * حتى لا يبقى على تاريخ قديم بعد استلام الدفعة.
 */
export default function AnnualPaymentForm({
  clientId, remaining, nextPaymentDate,
}: { clientId: number; remaining: number; nextPaymentDate: string | null }) {
  const qc = useQueryClient()
  const currentNext = nextPaymentDate ? nextPaymentDate.slice(0, 10) : ''

  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [nextDate, setNextDate] = useState(currentNext)

  const value = Number(amount)
  const validAmount = amount !== '' && value > 0 && value <= remaining
  // دفعة تُسدِّد المتبقي كاملاً تُنهي حساب العميل، فلا معنى لتاريخ دفعة قادمة.
  // أما الدفعة الجزئية فيبقى عليها رصيد، والتاريخ إلزامي ليعمل التنبيه.
  const settlesAll = validAmount && value >= remaining
  const needsNextDate = validAmount && !settlesAll

  const save = useMutation({
    mutationFn: async () => {
      await apiFetch<unknown>('/api/client-payments', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          amount: Number(amount),
          isDone: true,
          notes: notes || undefined,
          nextPaymentDate: settlesAll ? undefined : nextDate || undefined,
        }),
      })
      if (!settlesAll && nextDate && nextDate !== currentNext) {
        await apiFetch<unknown>(`/api/clients/${clientId}`, {
          method: 'PUT',
          body: JSON.stringify({ nextPaymentDate: nextDate }),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setAmount('')
      setNotes('')
    },
  })

  const disabled = save.isPending || !validAmount || (needsNextDate && !nextDate)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!disabled) save.mutate() }}
      className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-xs font-semibold text-gray-600 mb-3">
        تسجيل دفعة (المتبقي: {remaining.toLocaleString('en-US')} ر.س)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className={labelCls}>المبلغ المستلم (ر.س)</label>
          <input type="number" min={1} max={remaining} value={amount}
            onChange={(e) => {
              const val = Number(e.target.value)
              setAmount(val > remaining ? String(remaining) : e.target.value)
            }}
            className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>
            تاريخ الدفعة القادمة
            {needsNextDate && <span className="text-red-500"> *</span>}
          </label>
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
            disabled={settlesAll}
            className={`${inputCls}${settlesAll ? ' bg-gray-100 text-gray-400' : ''}`} />
          <p className="mt-1 text-xs text-gray-400">
            {settlesAll
              ? 'الدفعة تُسدِّد المتبقي كاملاً'
              : needsNextDate
                ? 'مطلوب — يبقى رصيد بعد هذه الدفعة'
                : 'يُستخدم لتنبيه الدفعة القادمة'}
          </p>
        </div>
        <div>
          <label className={labelCls}>ملاحظات</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات اختيارية" className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={disabled}
        className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                   text-white text-sm font-semibold px-8 py-2.5 transition-colors">
        {save.isPending ? '...' : 'حفظ'}
      </button>
      {save.isError && (
        <p className="mt-2 text-xs text-red-600">
          {save.error instanceof Error ? save.error.message : 'تعذّر حفظ الدفعة'}
        </p>
      )}
    </form>
  )
}
