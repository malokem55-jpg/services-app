import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Modal from './Modal'
import { CARD_TYPE_OPTIONS, formatYears, cardTypeValue } from '../lib/clientForm'
import type { CardIssuance, OrgIssuancesResponse } from '../lib/clientForm'

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

// خيارات الإصدار — "بدون" ليست كرتًا يُصدر
const ISSUE_OPTIONS = CARD_TYPE_OPTIONS.filter((opt) => opt !== 'بدون')

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

/**
 * نافذة كرت العمل لعميل: إصدار كرت جديد (يخصم من رصيد مؤسسته) +
 * سجل إصداراته مع تعديل/حذف لتصحيح الأخطاء — الرصيد يُعاد حسابه من السجل.
 */
export default function ClientCardIssuancesModal({
  clientId, organizationId, organizationName, onClose,
}: {
  clientId: number
  organizationId: number | null
  organizationName: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [cardType, setCardType] = useState('')
  const [issuedAt, setIssuedAt] = useState(today())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editType, setEditType] = useState('')
  const [editDate, setEditDate] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const { data: issuances = [], isLoading } = useQuery<CardIssuance[]>({
    queryKey: ['card-issuances', { clientId }],
    queryFn: () => apiFetch<CardIssuance[]>(`/api/card-issuances?clientId=${clientId}`),
  })

  // رصيد المؤسسة لعرض المتبقي قبل الإصدار
  const { data: orgData } = useQuery<OrgIssuancesResponse>({
    queryKey: ['card-issuances', { organizationId }],
    queryFn: () => apiFetch<OrgIssuancesResponse>(`/api/card-issuances?organizationId=${organizationId}`),
    enabled: organizationId != null,
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['card-issuances'] })
    qc.invalidateQueries({ queryKey: ['client', clientId] })
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['organizations'] })
  }

  const issueCard = useMutation({
    mutationFn: (body: { clientId: number; cardType: string; issuedAt?: string }) =>
      apiFetch<CardIssuance>('/api/card-issuances', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setCardType(''); setIssuedAt(today()) },
  })

  const updateIssuance = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { cardType: string; issuedAt: string } }) =>
      apiFetch<CardIssuance>(`/api/card-issuances/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { invalidateAll(); setEditingId(null) },
  })

  const deleteIssuance = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/card-issuances/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateAll(); setDeleteConfirmId(null) },
  })

  function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    if (!cardType) return
    issueCard.mutate({ clientId, cardType, issuedAt: issuedAt || undefined })
  }

  function startEdit(issuance: CardIssuance) {
    setEditingId(issuance.id)
    setEditType(issuance.cardType)
    setEditDate(issuance.issuedAt.slice(0, 10))
    setDeleteConfirmId(null)
  }

  return (
    <Modal title="كرت العمل" size="lg" onClose={onClose}>
      {organizationId == null ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-amber-800">
            العميل غير مرتبط بمؤسسة — أضفه لمؤسسة أولًا ليمكن إصدار كرت له.
          </p>
        </div>
      ) : (
        <>
          {/* رصيد المؤسسة */}
          {orgData && (
            <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 mb-4">
              <p className="text-xs text-gray-500">
                رصيد <span className="font-semibold text-gray-700">{organizationName ?? 'المؤسسة'}</span> الحالي
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700
                                 px-2.5 py-0.5 text-xs font-semibold">
                  مسحوبة {formatYears(orgData.usedYears)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                  ${orgData.remainingYears <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  متبقية {formatYears(orgData.remainingYears)}
                </span>
              </div>
            </div>
          )}

          {/* إصدار كرت جديد */}
          <form onSubmit={handleIssue} className="mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>نوع الكرت</label>
                <select value={cardType} onChange={(e) => setCardType(e.target.value)} className={inputCls}>
                  <option value="">اختر النوع...</option>
                  {ISSUE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} ({formatYears(cardTypeValue(opt))})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>تاريخ الإصدار</label>
                <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)}
                  className={inputCls} />
              </div>
            </div>
            <button type="submit" disabled={issueCard.isPending || !cardType}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                         text-white text-sm font-semibold px-8 py-2.5 transition-colors">
              {issueCard.isPending ? '...' : 'إصدار كرت'}
            </button>
            {issueCard.isError && (
              <p className="text-xs text-red-600 mt-2">
                {issueCard.error instanceof Error ? issueCard.error.message : 'حدث خطأ'}
              </p>
            )}
          </form>
        </>
      )}

      {/* سجل الإصدارات */}
      <p className="text-xs font-semibold text-gray-600 mb-2">سجل الإصدارات</p>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : issuances.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          لا إصدارات لهذا العميل — كرته الحالي «بدون» أو جاء بكرته من جهة سابقة
        </p>
      ) : (
        <div className="space-y-2.5">
          {issuances.map((issuance) => (
            <div key={issuance.id}
              className="bg-gray-50 rounded-xl border border-gray-200 px-3.5 py-3">
              {editingId === issuance.id ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className={inputCls}>
                      {ISSUE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} ({formatYears(cardTypeValue(opt))})
                        </option>
                      ))}
                    </select>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                      className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateIssuance.mutate({ id: issuance.id, body: { cardType: editType, issuedAt: editDate } })}
                      disabled={updateIssuance.isPending}
                      className="text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600
                                 disabled:opacity-60 rounded-lg px-4 py-2 transition-colors">
                      {updateIssuance.isPending ? '...' : 'حفظ'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200
                                 rounded-lg px-4 py-2 transition-colors">
                      إلغاء
                    </button>
                  </div>
                  {updateIssuance.isError && editingId === issuance.id && (
                    <p className="text-xs text-red-600">
                      {updateIssuance.error instanceof Error ? updateIssuance.error.message : 'حدث خطأ'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {issuance.cardType}
                      <span className="text-emerald-600 font-medium text-xs"> ({formatYears(cardTypeValue(issuance.cardType))})</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(issuance.issuedAt)} • سنة {issuance.hijriYear} هـ
                    </p>
                    {issuance.countsTowardBalance === false && (
                      <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-600
                                       px-2 py-0.5 text-[11px] font-medium mt-1.5">
                        سنة سابقة — لا يُخصم من الرصيد الحالي
                      </span>
                    )}
                  </div>
                  {deleteConfirmId === issuance.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-600 font-medium whitespace-nowrap">حذف؟</span>
                      <button onClick={() => deleteIssuance.mutate(issuance.id)} disabled={deleteIssuance.isPending}
                        className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600
                                   disabled:opacity-60 rounded-lg px-2.5 py-1.5 transition-colors">
                        {deleteIssuance.isPending ? '...' : 'نعم'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200
                                   rounded-lg px-2.5 py-1.5 transition-colors">
                        لا
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(issuance)} aria-label="تعديل الإصدار"
                        className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                   hover:bg-sky-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => { setDeleteConfirmId(issuance.id); setEditingId(null) }} aria-label="حذف الإصدار"
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-600
                                   hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
