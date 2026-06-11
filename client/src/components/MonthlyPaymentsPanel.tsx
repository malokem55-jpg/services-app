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
// حقول الجدول تتمدد مع عمودها (تخطيط الجدول ثابت)، وأسهم الأرقام مخفية لتوفير مساحة
const cellInputCls =
  'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString('en-US') : '—'
}

/**
 * لوحة الدفعيات الشهرية: ملخص المستحق/المستلم/المتبقي، وجدول بتعديل inline
 * لكل دفعية. إدخال مبلغ مستلم أقل من الدفعية يتطلب تأكيد ترحيل الفرق
 * للدفعية القادمة.
 */
export default function MonthlyPaymentsPanel({
  clientId, monthlyAmount,
}: { clientId: number; monthlyAmount: number | null }) {
  const qc = useQueryClient()

  // ── تعديل inline ──
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editReceived, setEditReceived] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [carryOverAck, setCarryOverAck] = useState(false)
  // يظهر تنبيه الترحيل فقط بعد أول ضغطة على حفظ بمبلغ مستلم أقل من الدفعية
  const [showCarryOver, setShowCarryOver] = useState(false)

  const [deleteId, setDeleteId] = useState<number | null>(null)

  // ── إضافة أول دفعية عندما لا توجد دفعيات إطلاقاً ──
  const [newDueDate, setNewDueDate] = useState('')
  const [newAmount, setNewAmount] = useState(monthlyAmount != null ? String(monthlyAmount) : '')

  const { data: monthlies = [], isLoading } = useQuery<MonthlyPayment[]>({
    queryKey: ['client-payment-monthlies', clientId],
    queryFn: () => apiFetch<MonthlyPayment[]>(`/api/client-payment-monthlies?clientId=${clientId}`),
  })

  const rows = [...monthlies].sort((a, b) =>
    (a.receivedDate ?? '9999').localeCompare(b.receivedDate ?? '9999'))

  const totalDue = rows.reduce((s, m) => s + (m.amount ?? 0), 0)
  const totalReceived = rows.reduce((s, m) => s + (m.receivedAmount ?? 0), 0)
  const remaining = totalDue - totalReceived

  const amountNum = Number(editAmount)
  const receivedNum = Number(editReceived || '0')
  const shortfall = receivedNum > 0 && receivedNum < amountNum ? amountNum - receivedNum : 0

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['client-payment-monthlies', clientId] })
    qc.invalidateQueries({ queryKey: ['client', clientId] })
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  function resetEdit() {
    setEditingId(null)
    setEditAmount(''); setEditReceived(''); setEditNotes('')
    setCarryOverAck(false); setShowCarryOver(false)
  }

  function startEdit(m: MonthlyPayment) {
    setEditingId(m.id)
    setEditAmount(m.amount != null ? String(m.amount) : '')
    setEditReceived(String(m.receivedAmount ?? 0))
    setEditNotes(m.notes ?? '')
    setCarryOverAck(false); setShowCarryOver(false)
    setDeleteId(null)
    saveRow.reset()
  }

  const saveRow = useMutation({
    mutationFn: async ({ row, amount, received, notes }: {
      row: MonthlyPayment; amount: number; received: number; notes: string
    }) => {
      const isPay = row.status !== 'paid' && received > 0
      if (isPay) {
        // تعديل مبلغ الدفعية أولاً (إن تغيّر) ثم التسديد مع ترحيل الفرق
        if (amount !== (row.amount ?? 0)) {
          await apiFetch<unknown>(`/api/client-payment-monthlies/${row.id}`, {
            method: 'PUT', body: JSON.stringify({ amount }),
          })
        }
        await apiFetch<unknown>(`/api/client-payment-monthlies/${row.id}/pay`, {
          method: 'POST', body: JSON.stringify({ receivedAmount: received, notes: notes || undefined }),
        })
      } else {
        await apiFetch<unknown>(`/api/client-payment-monthlies/${row.id}`, {
          method: 'PUT', body: JSON.stringify({ amount, receivedAmount: received, notes }),
        })
      }
    },
    onSuccess: () => { invalidateAll(); resetEdit() },
  })

  const deleteRow = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/client-payment-monthlies/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateAll(); setDeleteId(null) },
  })

  const createInstallment = useMutation({
    mutationFn: (body: { clientId: number; month: string; receivedDate: string; amount: number; status: string }) =>
      apiFetch<unknown>('/api/client-payment-monthlies', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setNewDueDate('') },
  })

  function handleSave(m: MonthlyPayment) {
    if (!editAmount || amountNum <= 0 || receivedNum < 0 || receivedNum > amountNum) return
    const isPay = m.status !== 'paid' && receivedNum > 0
    // أول ضغطة على حفظ بمبلغ أقل: إظهار تنبيه الترحيل فقط
    if (isPay && shortfall > 0 && !showCarryOver) {
      setShowCarryOver(true)
      return
    }
    if (isPay && shortfall > 0 && !carryOverAck) return
    saveRow.mutate({ row: m, amount: amountNum, received: receivedNum, notes: editNotes })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newDueDate || !newAmount || Number(newAmount) <= 0) return
    createInstallment.mutate({
      clientId,
      month: newDueDate.slice(5, 7),
      receivedDate: newDueDate,
      amount: Number(newAmount),
      status: 'un-paid',
    })
  }

  return (
    <div>
      {/* ── ملخص المبالغ ── */}
      <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المستحق</p>
          <p className="text-base font-bold text-gray-900">{fmt(totalDue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المستلم</p>
          <p className="text-base font-bold text-emerald-600">{fmt(totalReceived)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">المبلغ المتبقي</p>
          <p className="text-base font-bold text-sky-700">{fmt(remaining)}</p>
        </div>
      </div>

      {/* ── إضافة أول دفعية عند عدم وجود دفعيات ── */}
      {!isLoading && rows.length === 0 && (
        <form onSubmit={handleCreate} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-3">
            لا توجد دفعيات شهرية — إضافة دفعية جديدة
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>تاريخ الاستلام</label>
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
        </form>
      )}

      {/* ── جدول الدفعيات ── */}
      {/* تخطيط ثابت: الأعمدة نسب من عرض النافذة فلا يظهر تمرير أفقي على الشاشات
          المتوسطة فما فوق؛ يبقى التمرير للهواتف الضيقة فقط (min-w على الجدول) */}
      <div className="rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[640px] sm:min-w-0 sm:table-fixed text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-sky-600 text-white text-right">
              <th className="px-3 py-3 text-xs font-semibold">الشهر</th>
              <th className="px-3 py-3 text-xs font-semibold">تاريخ الاستلام</th>
              <th className="px-3 py-3 text-xs font-semibold">المبلغ</th>
              <th className="px-3 py-3 text-xs font-semibold">المبلغ المستلم</th>
              <th className="px-3 py-3 text-xs font-semibold">ملاحظات</th>
              <th className="px-3 py-3 text-xs font-semibold">الحالة</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  جارٍ التحميل...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  لا توجد دفعيات شهرية مسجلة
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const isEditing = editingId === m.id
                return (
                  <MonthlyRowGroup key={m.id}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-700">{m.month ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                        {m.receivedDate ? m.receivedDate.slice(0, 10) : '—'}
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-3 py-2">
                            <input type="number" min={1} value={editAmount}
                              onChange={(e) => {
                                setEditAmount(e.target.value)
                                setCarryOverAck(false); setShowCarryOver(false)
                              }}
                              className={cellInputCls} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} max={amountNum || undefined} value={editReceived}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                setEditReceived(amountNum > 0 && val > amountNum ? String(amountNum) : e.target.value)
                                setCarryOverAck(false); setShowCarryOver(false)
                              }}
                              className={cellInputCls} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                              className={cellInputCls} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 font-semibold text-gray-900">{fmt(m.amount)}</td>
                          <td className="px-3 py-3 text-gray-700">{fmt(m.receivedAmount)}</td>
                          <td className="px-3 py-3 text-gray-400 text-xs">{m.notes ?? ''}</td>
                        </>
                      )}

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

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => handleSave(m)}
                              disabled={
                                saveRow.isPending || !editAmount || amountNum <= 0 ||
                                receivedNum > amountNum ||
                                (showCarryOver && shortfall > 0 && !carryOverAck)
                              }
                              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                                         text-white text-xs font-semibold px-3 py-1.5 transition-colors">
                              {saveRow.isPending ? '...' : 'حفظ'}
                            </button>
                            <button onClick={resetEdit}
                              className="rounded-lg bg-red-500 hover:bg-red-600
                                         text-white text-xs font-semibold px-3 py-1.5 transition-colors">
                              إلغاء
                            </button>
                          </div>
                        ) : deleteId === m.id ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => deleteRow.mutate(m.id)} disabled={deleteRow.isPending}
                              className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                                         rounded-lg px-2.5 py-1.5 transition-colors">
                              {deleteRow.isPending ? '...' : 'نعم'}
                            </button>
                            <button onClick={() => setDeleteId(null)}
                              className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                              لا
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => startEdit(m)} aria-label="تعديل الدفعية"
                              className="rounded-lg p-1.5 text-sky-500 hover:text-sky-700 hover:bg-sky-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteId(m.id)} aria-label="حذف الدفعية"
                              className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* تنبيه ترحيل الفرق — يظهر بعد أول ضغطة حفظ بمبلغ أقل */}
                    {isEditing && showCarryOver && shortfall > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={carryOverAck}
                              onChange={(e) => setCarryOverAck(e.target.checked)}
                              className="mt-0.5 w-4 h-4 shrink-0 accent-amber-600" />
                            <span className="text-xs text-amber-800 leading-relaxed">
                              المبلغ المدخل أقل من مبلغ الدفعية ({fmt(amountNum)} ر.س)، وسيتم ترحيل الفرق
                              <span className="font-bold"> {fmt(shortfall)} ر.س </span>
                              وإضافته إلى الدفعية القادمة. فعّل التأكيد ثم اضغط حفظ مرة أخرى.
                            </span>
                          </label>
                        </td>
                      </tr>
                    )}

                    {/* خطأ الحفظ */}
                    {isEditing && saveRow.isError && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
                          {saveRow.error instanceof Error ? saveRow.error.message : 'حدث خطأ'}
                        </td>
                      </tr>
                    )}
                  </MonthlyRowGroup>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// صفوف الجدول المتعددة لنفس الدفعية (الصف + تنبيه الترحيل) دون عنصر DOM إضافي
function MonthlyRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
