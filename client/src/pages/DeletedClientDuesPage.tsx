import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import CopyButton from '../components/CopyButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DueDetail {
  type: 'overdue' | 'carried' | 'remaining'
  amount: number
  receivedDate?: string
  carriedFromMonth?: string | null
}

interface DueCollection {
  date: string
  amount: number
  notes?: string
}

interface DeletedClientDue {
  id: number
  clientName: string | null
  phone: string | null
  passport: string | null
  iqamaNumber: string | null
  serviceName: string | null
  organizationName: string | null
  paymentType: string | null
  totalDue: number | null
  collectedAmount: number | null
  status: string | null
  details: DueDetail[] | null
  collections: DueCollection[] | null
  notes: string | null
  deletedAt: string | null
}

type StatusFilter = 'all' | 'pending' | 'collected'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US')
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function remainingOf(due: DeletedClientDue): number {
  return (due.totalDue ?? 0) - (due.collectedAmount ?? 0)
}

function detailLabel(d: DueDetail): string {
  if (d.type === 'overdue') {
    const carried = d.carriedFromMonth ? ` (تشمل مبلغاً مرحّلاً من ${d.carriedFromMonth})` : ''
    return `دفعية متأخرة بتاريخ ${fmtDate(d.receivedDate)}${carried}`
  }
  if (d.type === 'carried') {
    const from = d.carriedFromMonth ? ` من دفعية ${d.carriedFromMonth}` : ''
    return `مبلغ مرحّل${from} على دفعية ${fmtDate(d.receivedDate)}`
  }
  return 'المبلغ المتبقي من إجمالي الخدمة'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailsList({ details }: { details: DueDetail[] }) {
  return (
    <ul className="space-y-1.5">
      {details.map((d, i) => (
        <li key={i} className="flex items-center justify-between gap-2 text-sm
                               bg-red-50/50 border border-red-100 rounded-lg px-3 py-2">
          <span className="text-gray-700">{detailLabel(d)}</span>
          <span className="font-bold text-red-600 whitespace-nowrap">{fmt(d.amount)} ر.س</span>
        </li>
      ))}
    </ul>
  )
}

/** جدول التحصيلات داخل النافذة: إضافة وتعديل وحذف، والمجاميع يعيد الخادم احتسابها */
function CollectionsTable({ due }: { due: DeletedClientDue }) {
  const qc = useQueryClient()
  const collections = due.collections ?? []
  const remaining = (due.totalDue ?? 0) - (due.collectedAmount ?? 0)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addNotes, setAddNotes] = useState('')

  const add = useMutation({
    mutationFn: (body: { amount: number; date?: string; notes?: string }) =>
      apiFetch<DeletedClientDue>(`/api/deleted-client-dues/${due.id}/collections`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
      setAddAmount('')
      setAddNotes('')
      setAddDate(new Date().toISOString().slice(0, 10))
    },
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(addAmount)
    if (!amount || amount <= 0) return
    add.mutate({
      amount,
      ...(addDate && { date: addDate }),
      ...(addNotes.trim() && { notes: addNotes.trim() }),
    })
  }

  const update = useMutation({
    mutationFn: (vars: { index: number; amount: number; date: string; notes?: string }) =>
      apiFetch<DeletedClientDue>(`/api/deleted-client-dues/${due.id}/collections/${vars.index}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: vars.amount, date: vars.date, notes: vars.notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
      setEditIndex(null)
    },
  })

  const remove = useMutation({
    mutationFn: (index: number) =>
      apiFetch<DeletedClientDue>(`/api/deleted-client-dues/${due.id}/collections/${index}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
      setDeleteIndex(null)
    },
  })

  function startEdit(index: number) {
    const c = collections[index]
    setEditDate(c.date?.slice(0, 10) ?? '')
    setEditAmount(String(c.amount ?? ''))
    setEditNotes(c.notes ?? '')
    setEditIndex(index)
    setDeleteIndex(null)
    update.reset()
  }

  function saveEdit(index: number) {
    const amount = Number(editAmount)
    if (!amount || amount <= 0 || !editDate) return
    update.mutate({
      index,
      amount,
      date: editDate,
      ...(editNotes.trim() && { notes: editNotes.trim() }),
    })
  }

  // الحد الأقصى لمبلغ الصف المعدَّل: إجمالي الدين ناقص باقي التحصيلات
  const maxForEdit = editIndex !== null
    ? (due.totalDue ?? 0) - collections.reduce(
        (sum, c, i) => (i === editIndex ? sum : sum + (c.amount ?? 0)), 0)
    : 0

  const editInputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500'

  return (
    <div className="space-y-4">
      {/* ── تسجيل تحصيل جديد ── */}
      {remaining > 0 ? (
        <form onSubmit={handleAdd}
          className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-3">
            تسجيل تحصيل جديد (المتبقي: {fmt(remaining)} ر.س)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelCls}>المبلغ المحصَّل (ر.س)</label>
              <input type="number" min={1} max={remaining} value={addAmount}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setAddAmount(val > remaining ? String(remaining) : e.target.value)
                }}
                required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>تاريخ التحصيل</label>
              <input type="date" value={addDate}
                onChange={(e) => setAddDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ملاحظات</label>
              <input type="text" value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="ملاحظات اختيارية" className={inputCls} />
            </div>
          </div>
          <button type="submit"
            disabled={add.isPending || !addAmount || Number(addAmount) <= 0}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                       text-white text-sm font-semibold px-8 py-2.5 transition-colors">
            {add.isPending ? '...' : 'حفظ'}
          </button>
          {add.isError && (
            <p className="text-xs text-red-600 mt-2">
              {add.error instanceof Error ? add.error.message : 'حدث خطأ'}
            </p>
          )}
        </form>
      ) : (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3
                        text-sm text-emerald-700 text-center font-medium">
          تم تحصيل الدين كاملاً
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-600 text-white text-right">
              <th className="px-4 py-3 text-xs font-semibold">تاريخ التحصيل</th>
              <th className="px-4 py-3 text-xs font-semibold">المبلغ المحصَّل</th>
              <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  لا توجد تحصيلات مسجلة
                </td>
              </tr>
            ) : (
              collections.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  {editIndex === i ? (
                    <>
                      <td className="px-3 py-2">
                        <input type="date" value={editDate}
                          onChange={(e) => setEditDate(e.target.value)} className={editInputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} max={maxForEdit} value={editAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setEditAmount(val > maxForEdit ? String(maxForEdit) : e.target.value)
                          }}
                          className={editInputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="اختياري" className={editInputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 justify-center">
                          <button onClick={() => saveEdit(i)} disabled={update.isPending}
                            className="text-xs text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                                       rounded-lg px-3 py-1.5 transition-colors font-medium">
                            {update.isPending ? '...' : 'حفظ'}
                          </button>
                          <button onClick={() => setEditIndex(null)}
                            className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200
                                       rounded-lg px-2.5 py-1.5 transition-colors font-medium">
                            إلغاء
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{fmtDate(c.date)}</span>
                          {c.date && <CopyButton value={fmtDate(c.date)} label="تاريخ التحصيل" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">
                        <div className="flex items-center gap-1.5">
                          <span>{fmt(c.amount)} ر.س</span>
                          {c.amount != null && <CopyButton value={fmt(c.amount)} label="المبلغ المحصَّل" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{c.notes ?? ''}</span>
                          {c.notes && <CopyButton value={c.notes} label="ملاحظات" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {deleteIndex === i ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <button onClick={() => remove.mutate(i)} disabled={remove.isPending}
                              className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                                         rounded-lg px-3 py-1.5 transition-colors font-medium">
                              {remove.isPending ? '...' : 'نعم'}
                            </button>
                            <button onClick={() => setDeleteIndex(null)}
                              className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200
                                         rounded-lg px-2.5 py-1.5 transition-colors font-medium">
                              لا
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => startEdit(i)} aria-label="تعديل التحصيلة"
                              className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50
                                         transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => { setDeleteIndex(i); setEditIndex(null) }} aria-label="حذف التحصيلة"
                              className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50
                                         transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(update.isError || remove.isError) && (
        <p className="text-sm text-red-600">
          {update.error instanceof Error
            ? update.error.message
            : remove.error instanceof Error
              ? remove.error.message
              : 'حدث خطأ'}
        </p>
      )}
    </div>
  )
}

function DueCard({ due }: { due: DeletedClientDue }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  const totalDue = due.totalDue ?? 0
  const collected = due.collectedAmount ?? 0
  const remaining = totalDue - collected
  const isCollected = due.status === 'collected'

  const saveNotes = useMutation({
    mutationFn: (notes: string) =>
      apiFetch<DeletedClientDue>(`/api/deleted-client-dues/${due.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
      setEditingNotes(false)
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<unknown>(`/api/deleted-client-dues/${due.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
    },
  })

  // زر التحصيل في الصف المضغوط يفتح نافذة السجل — الإضافة تتم من داخلها
  function openQuickCollect() {
    setShowCollections(true)
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden
                     ${isCollected ? 'border-emerald-100' : 'border-gray-100'}`}>

      {/* ── الصف المضغوط: الاسم والحالة والمتبقي فقط ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex flex-1 min-w-0 items-center gap-2.5 text-start py-1 rounded-lg
                     hover:bg-gray-50/80 transition-colors"
        >
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-bold text-gray-900 truncate">
            {due.clientName ?? 'عميل بدون اسم'}
          </span>
          {isCollected ? (
            <span className="hidden sm:inline-flex text-xs font-medium text-emerald-700 bg-emerald-50
                             border border-emerald-200 rounded-lg px-2 py-0.5 shrink-0">
              تم التحصيل
            </span>
          ) : (
            <span className="hidden sm:inline-flex text-xs font-medium text-red-700 bg-red-50
                             border border-red-200 rounded-lg px-2 py-0.5 shrink-0">
              معلّق
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-center">
          <div>
            <p className="text-[11px] text-gray-400 leading-none mb-1">الإجمالي</p>
            <p className="text-xs sm:text-sm font-bold text-gray-900 leading-none tabular-nums">
              {fmt(totalDue)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 leading-none mb-1">المحصَّل</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 leading-none tabular-nums">
              {fmt(collected)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 leading-none mb-1">المتبقي</p>
            <p className={`text-xs sm:text-sm font-bold leading-none tabular-nums
                           ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmt(remaining)}
            </p>
          </div>
        </div>

        {!isCollected && (
          <button
            onClick={openQuickCollect}
            className="flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100
                       border border-emerald-200 text-emerald-700 text-xs font-semibold
                       px-3 py-1.5 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            تحصيل
          </button>
        )}
      </div>

      {/* ── التفاصيل — توسيع مضغوط: سطر بيانات + مبالغ + ملخصات قابلة للفتح ── */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* بيانات العميل المنسوخة: صفّان ثابتان، والمفقود يظهر "غير مدخل" */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
            {([
              ['رقم الجوال', due.phone],
              ['رقم الإقامة', due.iqamaNumber],
              ['المؤسسة السابقة', due.organizationName],
              ['حذف في', due.deletedAt ? fmtDate(due.deletedAt) : null],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <span key={label} className="inline-flex items-baseline gap-1.5 min-w-0">
                <span className="text-gray-400 shrink-0">{label}:</span>
                {value ? (
                  <span className="font-semibold text-gray-700 truncate">{value}</span>
                ) : (
                  <span className="text-gray-300">غير مدخل</span>
                )}
              </span>
            ))}
          </div>

          {/* الملاحظات: تُعرض فقط إن وُجدت، والتعديل من زر في صف الإجراءات */}
          {editingNotes ? (
            <div className="space-y-2">
              <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)}
                rows={3} autoFocus placeholder="مثال: وعد بالسداد نهاية الشهر، رقم جوال بديل..."
                className={`${inputCls} resize-y`} />
              {saveNotes.isError && (
                <p className="text-sm text-red-600">
                  {saveNotes.error instanceof Error ? saveNotes.error.message : 'حدث خطأ'}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => saveNotes.mutate(notesDraft)} disabled={saveNotes.isPending}
                  className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                             text-white text-xs font-semibold px-3 py-1.5 transition-colors">
                  {saveNotes.isPending ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
                </button>
                <button onClick={() => setEditingNotes(false)}
                  className="rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600
                             text-xs font-medium px-3 py-1.5 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          ) : due.notes ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg
                          px-3 py-2 whitespace-pre-line">
              {due.notes}
            </p>
          ) : null}

          {/* الإجراءات — التحصيل من زر الصف المضغوط (يفتح نافذة السجل) */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            {due.details && due.details.length > 0 && (
              <button onClick={() => setShowDetails(true)}
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-white hover:bg-red-50
                           text-red-600 text-xs font-medium px-3 py-2 min-h-9 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                تفاصيل الدين ({due.details.length})
              </button>
            )}

            <button
              onClick={() => setShowCollections(true)}
              disabled={!due.collections || due.collections.length === 0}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white
                         hover:bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-2 min-h-9
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         disabled:hover:bg-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              سجل التحصيلات ({due.collections?.length ?? 0})
            </button>

            {!editingNotes && (
              <button
                onClick={() => { setNotesDraft(due.notes ?? ''); setEditingNotes(true); saveNotes.reset() }}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white hover:bg-sky-50
                           hover:border-sky-200 text-gray-500 hover:text-sky-700 text-xs font-medium
                           px-3 py-2 min-h-9 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {due.notes ? 'تعديل الملاحظات' : 'إضافة ملاحظة'}
              </button>
            )}

            {showDelete ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-700 font-medium whitespace-nowrap">حذف السجل نهائياً؟</span>
                <button onClick={() => remove.mutate()} disabled={remove.isPending}
                  className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                             rounded-lg px-3 py-1.5 transition-colors font-medium">
                  {remove.isPending ? '...' : 'نعم'}
                </button>
                <button onClick={() => setShowDelete(false)}
                  className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5
                             transition-colors font-medium">
                  لا
                </button>
              </div>
            ) : (
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-white hover:bg-red-50
                           text-red-600 text-xs font-medium px-3 py-2 min-h-9 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف السجل
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── نافذة تفاصيل الدين — نفس منطق نافذة الدفعيات ── */}
      {showDetails && due.details && (
        <Modal title={`تفاصيل الدين — ${due.clientName ?? 'عميل بدون اسم'}`} size="lg"
          onClose={() => setShowDetails(false)}>
          <DetailsList details={due.details} />
        </Modal>
      )}

      {/* ── نافذة سجل التحصيلات ── */}
      {showCollections && (
        <Modal title={`سجل التحصيلات — ${due.clientName ?? 'عميل بدون اسم'}`} size="lg"
          onClose={() => setShowCollections(false)}>
          <CollectionsTable due={due} />
        </Modal>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'معلّقة' },
  { id: 'collected', label: 'محصَّلة' },
  { id: 'all', label: 'الكل' },
]

export default function DeletedClientDuesPage() {
  // الافتراضي "معلّقة": المحصَّلة أرشيف لا يزاحم المشهد
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [search, setSearch] = useState('')

  const { data: dues, isLoading, isError, error } = useQuery<DeletedClientDue[]>({
    queryKey: ['deleted-client-dues'],
    queryFn: () => apiFetch<DeletedClientDue[]>('/api/deleted-client-dues'),
  })

  const all = dues ?? []
  const pending = all.filter((d) => d.status === 'pending')
  const totalRemaining = pending.reduce((sum, d) => sum + remainingOf(d), 0)

  const byStatus = filter === 'all' ? all : all.filter((d) => (d.status ?? 'pending') === filter)
  const term = search.trim()
  const visible = (term
    ? byStatus.filter((d) =>
        [d.clientName, d.iqamaNumber].some(
          (field) => field && field.includes(term),
        ),
      )
    : byStatus
  ).slice().sort((a, b) => remainingOf(b) - remainingOf(a)) // الأكبر ديناً أولاً

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-4 space-y-3 page-enter">

        {/* ── العنوان + ملخص الديون كشارات في صف واحد ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900">ديون العملاء المحذوفين</h2>
          <div className="flex items-center gap-2 ms-auto">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl
                            px-3.5 py-2 shadow-sm">
              <span className="text-xs font-medium text-red-600">ديون معلّقة</span>
              <span className="text-lg font-extrabold text-red-700 tabular-nums leading-none">
                {pending.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl
                            px-3.5 py-2 shadow-sm">
              <span className="text-xs font-medium text-gray-500">إجمالي المتبقي</span>
              <span className="text-lg font-extrabold text-red-700 tabular-nums leading-none">
                {fmt(totalRemaining)} <span className="text-xs font-semibold text-gray-400">ر.س</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── البحث + الفلترة + الترتيب في صف واحد ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <svg className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الإقامة..."
              className="w-full rounded-xl border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm min-h-9
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         transition-colors" />
          </div>

          <div className="flex items-center gap-0.5 bg-white border border-gray-100 rounded-xl p-0.5 shadow-sm">
            {FILTERS.map(({ id, label }) => (
              <button key={id} onClick={() => setFilter(id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === id
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-sky-700 hover:bg-sky-50'
                }`}>
                {label}
              </button>
            ))}
          </div>

        </div>

        {/* ── Content ── */}
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            {error instanceof Error ? error.message : 'تعذّر تحميل البيانات'}
          </div>
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500">
              {term
                ? 'لا توجد نتائج مطابقة للبحث'
                : filter === 'all'
                  ? 'لا توجد ديون محفوظة — عند حذف عميل عليه مستحقات ستظهر هنا تلقائياً'
                  : 'لا توجد سجلات ضمن هذا التصنيف'}
            </p>
          </div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <div className="space-y-2">
            {visible.map((due) => (
              <DueCard key={due.id} due={due} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
