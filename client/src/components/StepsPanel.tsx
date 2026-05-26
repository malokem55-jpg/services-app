import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface Step {
  id: number
  name: string | null
  number: string | null
  order: number | null
  serviceId: number | null
}

export default function StepsPanel({ serviceId }: { serviceId: number }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')

  const { data: steps = [], isLoading } = useQuery<Step[]>({
    queryKey: ['service-steps', serviceId],
    queryFn: () => apiFetch<Step[]>(`/api/service-steps?serviceId=${serviceId}`),
  })

  const addStep = useMutation({
    mutationFn: (body: { name: string; number?: string; serviceId: number }) =>
      apiFetch<Step>('/api/service-steps', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-steps', serviceId] })
      qc.invalidateQueries({ queryKey: ['services'] })
      setName('')
      setNumber('')
    },
  })

  const moveStep = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: 'up' | 'down' }) =>
      apiFetch<Step[]>(`/api/service-steps/${id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ direction }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-steps', serviceId] })
    },
  })

  const deleteStep = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/service-steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-steps', serviceId] })
      qc.invalidateQueries({ queryKey: ['services'] })
    },
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    addStep.mutate({ name: name.trim(), number: number.trim() || undefined, serviceId })
  }

  return (
    <div className="bg-sky-50/50 border-t border-sky-100 px-5 py-4 space-y-3">

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-sky-100/60 animate-pulse" />
          ))}
        </div>
      ) : steps.length === 0 ? (
        <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-white border border-sky-100 text-sm text-gray-400">
          <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          لا توجد خطوات بعد — أضف أول خطوة
        </div>
      ) : (
        <ul className="space-y-1.5">
          {steps.map((step, idx) => (
            <li
              key={step.id}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3
                         border border-sky-100 shadow-sm"
            >
              <span className="text-sm text-gray-800 flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
                                 bg-sky-500 text-white text-xs font-bold shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium">{step.name ?? '—'}</span>
                {step.number && (
                  <span className="text-xs text-gray-400 font-mono">#{step.number}</span>
                )}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => moveStep.mutate({ id: step.id, direction: 'up' })}
                  disabled={idx === 0 || moveStep.isPending}
                  aria-label="تحريك للأعلى"
                  className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50
                             disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveStep.mutate({ id: step.id, direction: 'down' })}
                  disabled={idx === steps.length - 1 || moveStep.isPending}
                  aria-label="تحريك للأسفل"
                  className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50
                             disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteStep.mutate(step.id)}
                  disabled={deleteStep.isPending}
                  aria-label="حذف الخطوة"
                  className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50
                             disabled:opacity-40 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(addStep.isError || deleteStep.isError || moveStep.isError) && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {((addStep.error ?? deleteStep.error ?? moveStep.error) instanceof Error
            ? (addStep.error ?? deleteStep.error ?? moveStep.error) as Error
            : null)?.message ?? 'حدث خطأ'}
        </p>
      )}

      {/* Add step form */}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الخطوة"
          required
          className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11"
        />
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="رقم (اختياري)"
          className="w-28 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11"
        />
        <button
          type="submit"
          disabled={addStep.isPending}
          className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                     text-white px-4 py-2.5 text-sm font-semibold min-h-11 transition-colors"
        >
          {addStep.isPending ? '...' : 'إضافة'}
        </button>
      </form>
    </div>
  )
}
