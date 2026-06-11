import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { formatYears, cardTypeValue } from '../lib/clientForm'
import type { OrgIssuancesResponse } from '../lib/clientForm'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

/**
 * سجل إصدارات كروت العمل لمؤسسة في السنة الهجرية الحالية:
 * ملخص المسحوبة/المتبقية + قائمة الإصدارات مع إمكانية حذف إصدار خاطئ.
 */
export default function OrgCardIssuancesModal({
  orgId, orgName, onClose,
}: { orgId: number; orgName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { data, isLoading, isError } = useQuery<OrgIssuancesResponse>({
    queryKey: ['card-issuances', { organizationId: orgId }],
    queryFn: () => apiFetch<OrgIssuancesResponse>(`/api/card-issuances?organizationId=${orgId}`),
  })

  const deleteIssuance = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/card-issuances/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-issuances'] })
      qc.invalidateQueries({ queryKey: ['organizations'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client'] })
      setDeleteConfirmId(null)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white w-full sm:max-w-2xl
                   rounded-t-3xl sm:rounded-2xl shadow-2xl
                   max-h-[92dvh] overflow-hidden flex flex-col
                   slide-up sm:modal-enter"
      >
        {/* drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">سجل كروت العمل</h2>
            <p className="text-xs text-sky-600 font-medium mt-0.5">
              {orgName} — كروت العمل المصدرة في السنة الهجرية الحالية
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700
                                 px-2.5 py-0.5 text-xs font-semibold">
                  مسحوبة {formatYears(data.usedYears)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                  ${data.remainingYears <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  متبقية {formatYears(data.remainingYears)}
                </span>
              </>
            )}
            <button onClick={onClose} aria-label="إغلاق"
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              تعذّر تحميل سجل الإصدارات.
            </div>
          ) : !data || data.issuances.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 10h18M7 15h2m4 0h4M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium text-sm">لا إصدارات منذ آخر منح — الرصيد كامل (4)</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.issuances.map((issuance) => (
                <div key={issuance.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl border border-gray-200 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {issuance.clientName ?? 'عميل محذوف'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {issuance.cardType}
                      <span className="text-emerald-600 font-medium"> ({formatYears(cardTypeValue(issuance.cardType))})</span>
                      {' • '}{formatDate(issuance.issuedAt)}
                    </p>
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
                    <button onClick={() => setDeleteConfirmId(issuance.id)} aria-label="حذف الإصدار"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-red-600
                                 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
