import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { ArrivalPlaceOption } from '../lib/clientForm'

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'

/**
 * قسم "جهات القدوم" في صفحة الإعدادات: إضافة وتعديل وحذف الجهات التي
 * يُختار منها حقل جهة القدوم للعميل تحت الإجراء.
 */
export default function ArrivalPlacesSection() {
  const qc = useQueryClient()

  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: places = [], isLoading, isError } = useQuery<ArrivalPlaceOption[]>({
    queryKey: ['arrival-places'],
    queryFn: () => apiFetch<ArrivalPlaceOption[]>('/api/arrival-places'),
    staleTime: 5 * 60 * 1000,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['arrival-places'] })
  }

  const createPlace = useMutation({
    mutationFn: (name: string) =>
      apiFetch<ArrivalPlaceOption>('/api/arrival-places', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => { invalidate(); setNewName('') },
  })

  const updatePlace = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiFetch<ArrivalPlaceOption>(`/api/arrival-places/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => { invalidate(); setEditId(null); setEditName('') },
  })

  const deletePlace = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/arrival-places/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      setDeleteId(null)
      // العملاء المرتبطون بالجهة المحذوفة يصبح حقلهم فارغاً على السيرفر
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createPlace.mutate(name)
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const name = editName.trim()
    if (editId === null || !name) return
    updatePlace.mutate({ id: editId, name })
  }

  function startEdit(place: ArrivalPlaceOption) {
    setEditId(place.id)
    setEditName(place.name)
    setDeleteId(null)
  }

  const mutationError =
    (createPlace.isError && createPlace.error) ||
    (updatePlace.isError && updatePlace.error) ||
    (deletePlace.isError && deletePlace.error) ||
    null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-sky-700">جهات القدوم</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          القائمة التي يُختار منها حقل جهة القدوم للعميل تحت الإجراء
        </p>
      </div>

      <div className="p-5 md:p-4 space-y-4 md:space-y-3">
        {/* ── إضافة جهة ── */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم الجهة الجديدة..."
            className={inputCls}
          />
          <button
            type="submit"
            disabled={createPlace.isPending || !newName.trim()}
            className="shrink-0 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                       text-white text-sm font-semibold px-5 min-h-11 transition-colors"
          >
            {createPlace.isPending ? '...' : 'إضافة'}
          </button>
        </form>

        {mutationError instanceof Error && (
          <p className="text-sm text-red-600">{mutationError.message}</p>
        )}

        {isError && (
          <p className="text-sm text-red-600">تعذّر تحميل جهات القدوم، حاول تحديث الصفحة.</p>
        )}

        {/* ── القائمة ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">لا توجد جهات مضافة بعد</p>
        ) : (
          <ul className="space-y-2">
            {places.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
              >
                {editId === place.id ? (
                  /* ── وضع التعديل ── */
                  <form onSubmit={handleUpdate} className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      disabled={updatePlace.isPending || !editName.trim()}
                      className="shrink-0 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                                 text-white text-xs font-semibold px-3 py-2 transition-colors"
                    >
                      {updatePlace.isPending ? '...' : 'حفظ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditId(null); setEditName('') }}
                      className="shrink-0 rounded-lg bg-gray-100 hover:bg-gray-200
                                 text-gray-600 text-xs font-medium px-3 py-2 transition-colors"
                    >
                      إلغاء
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{place.name}</span>

                    {deleteId === place.id ? (
                      /* ── تأكيد الحذف ── */
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-600 font-medium whitespace-nowrap">حذف الجهة؟</span>
                        <button
                          onClick={() => deletePlace.mutate(place.id)}
                          disabled={deletePlace.isPending}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                                     rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          {deletePlace.isPending ? '...' : 'نعم'}
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          لا
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(place)}
                          aria-label={`تعديل ${place.name}`}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                     hover:bg-sky-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setDeleteId(place.id); setEditId(null) }}
                          aria-label={`حذف ${place.name}`}
                          className="shrink-0 rounded-lg p-1.5 text-red-400 hover:text-red-600
                                     hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-gray-400">
          حذف جهة لا يحذف العملاء المرتبطين بها — يصبح حقل جهة القدوم عندهم فارغاً.
        </p>
      </div>
    </div>
  )
}
