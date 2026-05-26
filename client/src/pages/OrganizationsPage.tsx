import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'

interface OrgItem {
  id: number
  name: string | null
  number: string | null
  expiredDate: string | null
  cardTotal: number
  _count: { clients: number }
}

interface OrgFormData {
  name: string
  number: string
  expiredDate: string
}

const EMPTY_FORM: OrgFormData = { name: '', number: '', expiredDate: '' }

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function orgToForm(org: OrgItem): OrgFormData {
  return {
    name: org.name ?? '',
    number: org.number ?? '',
    expiredDate: toInputDate(org.expiredDate),
  }
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function OrganizationsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; org: OrgItem | null }>({
    open: false, org: null,
  })
  const [form, setForm] = useState<OrgFormData>(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: orgs = [], isLoading, isError } = useQuery<OrgItem[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgItem[]>('/api/organizations'),
  })

  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return orgs
    return orgs.filter((o) => o.name?.includes(search.trim()))
  }, [orgs, search])

  function openAdd() { setForm(EMPTY_FORM); setModal({ open: true, org: null }) }
  function openEdit(org: OrgItem) { setForm(orgToForm(org)); setModal({ open: true, org }) }
  function closeModal() { setModal({ open: false, org: null }); setForm(EMPTY_FORM) }
  function setField(field: keyof OrgFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }
  function buildPayload(f: OrgFormData) {
    return {
      name: f.name || undefined,
      number: f.number || undefined,
      expiredDate: f.expiredDate || undefined,
    }
  }

  const createOrg = useMutation({
    mutationFn: (body: ReturnType<typeof buildPayload>) =>
      apiFetch<OrgItem>('/api/organizations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      closeModal()
    },
  })

  const updateOrg = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReturnType<typeof buildPayload> }) =>
      apiFetch<OrgItem>(`/api/organizations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organizations'] }); closeModal() },
  })

  const deleteOrg = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/organizations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeleteConfirmId(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = buildPayload(form)
    if (modal.org) updateOrg.mutate({ id: modal.org.id, body: payload })
    else createOrg.mutate(payload)
  }

  const isPending = createOrg.isPending || updateOrg.isPending
  const mutationError = createOrg.error ?? updateOrg.error

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6 page-enter">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">المؤسسات</h2>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredOrgs.length} مؤسسة{search.trim() ? ' (بحث)' : ''}
              </p>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700
                       text-white text-sm font-semibold rounded-xl px-4 py-2.5 min-h-11
                       shadow-sm shadow-sky-500/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            إضافة مؤسسة
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <svg className="pointer-events-none absolute inset-y-0 inset-e-3 my-auto w-4 h-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المؤسسة..."
            className="w-full rounded-xl border border-gray-200 bg-white pe-10 ps-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11" />
        </div>

        {isError && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل المؤسسات، حاول تحديث الصفحة.
          </div>
        )}

        {/* ── Mobile: card list ── */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          ) : filteredOrgs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h6" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">
                {search.trim() ? 'لا توجد نتائج للبحث' : 'لا توجد مؤسسات بعد'}
              </p>
            </div>
          ) : (
            filteredOrgs.map((org) => (
              <div key={org.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{org.name ?? '—'}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700
                                       px-2 py-0.5 text-xs font-semibold">
                        {org._count.clients} فرد
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    {org.number && <span className="font-mono">{org.number}</span>}
                    {org.expiredDate && <span>{formatDate(org.expiredDate)}</span>}
                    {org.cardTotal > 0 && (
                      <span className="text-sky-600 font-medium">
                        كروت: {org.cardTotal % 1 === 0 ? org.cardTotal : org.cardTotal.toFixed(2).replace(/\.?0+$/, '')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex border-t border-gray-100">
                  {deleteConfirmId === org.id ? (
                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4">
                      <span className="text-xs text-red-600 font-medium">تأكيد الحذف؟</span>
                      <button onClick={() => deleteOrg.mutate(org.id)} disabled={deleteOrg.isPending}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 font-medium transition-colors">
                        {deleteOrg.isPending ? '...' : 'نعم'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                        لا
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => openEdit(org)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                                   text-sky-600 hover:bg-sky-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        تعديل
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => setDeleteConfirmId(org.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                                   text-red-500 hover:bg-red-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-3 text-xs font-semibold text-sky-700">اسم المؤسسة</th>
                  <th className="px-4 py-3 text-xs font-semibold text-sky-700 text-center w-20">الأفراد</th>
                  <th className="px-4 py-3 text-xs font-semibold text-sky-700 text-center">كروت العمل</th>
                  <th className="px-4 py-3 text-xs font-semibold text-sky-700">رقم السجل</th>
                  <th className="px-4 py-3 text-xs font-semibold text-sky-700">انتهاء السجل</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${55 + j * 15}%` }} />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))
                  : filteredOrgs.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h6" />
                            </svg>
                          </div>
                          <p className="text-gray-500 font-medium">
                            {search.trim() ? 'لا توجد نتائج للبحث' : 'لا توجد مؤسسات مضافة بعد'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
                  : filteredOrgs.map((org) => (
                    <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-gray-900">{org.name ?? '—'}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full
                                         bg-gray-100 text-xs font-semibold text-gray-600 px-2">
                          {org._count.clients}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center h-7 rounded-full
                                         bg-sky-100 text-xs font-semibold text-sky-700 px-2.5">
                          {org.cardTotal % 1 === 0 ? org.cardTotal : org.cardTotal.toFixed(2).replace(/\.?0+$/, '')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-500 tracking-wide">
                        {org.number ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 text-sm whitespace-nowrap">
                        {formatDate(org.expiredDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        {deleteConfirmId === org.id ? (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-red-600 font-medium whitespace-nowrap">تأكيد الحذف؟</span>
                            <button onClick={() => deleteOrg.mutate(org.id)} disabled={deleteOrg.isPending}
                              className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600
                                         disabled:opacity-60 rounded-lg px-2.5 py-1.5 transition-colors">
                              {deleteOrg.isPending ? '...' : 'نعم'}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200
                                         rounded-lg px-2.5 py-1.5 transition-colors">
                              لا
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(org)} aria-label="تعديل"
                              className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                         hover:bg-sky-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteConfirmId(org.id)} aria-label="حذف"
                              className="rounded-lg p-1.5 text-gray-400 hover:text-red-600
                                         hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add / Edit Modal */}
      {modal.open && (
        <Modal
          title={modal.org ? 'تعديل المؤسسة' : 'إضافة مؤسسة جديدة'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>اسم المؤسسة</label>
              <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                placeholder="اسم المؤسسة" autoFocus className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>رقم السجل</label>
              <input type="text" value={form.number} onChange={(e) => setField('number', e.target.value)}
                placeholder="رقم السجل التجاري" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>تاريخ انتهاء السجل</label>
              <input type="date" value={form.expiredDate} onChange={(e) => setField('expiredDate', e.target.value)}
                className={inputCls} />
            </div>

            {mutationError && (
              <p className="text-sm text-red-600">
                {mutationError instanceof Error ? mutationError.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={closeModal}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={isPending}
                className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-11 transition-colors">
                {isPending ? 'جارٍ الحفظ...' : modal.org ? 'حفظ التعديلات' : 'إضافة'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
