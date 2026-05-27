import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import {
  type ClientFormData,
  type ServiceOption,
  type OrgOption,
  buildClientPayload,
  iqamaStatus,
} from '../lib/clientForm'
import { clientSchema, clientStepSchema, clientPaymentSchema, getErrors } from '../lib/schemas'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import ClientFormFields from '../components/ClientFormFields'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientStep {
  id: number
  stepDate: string | null
  step: { id: number; name: string | null; order: number | null } | null
}

interface ClientPayment {
  id: number
  amount: number | null
  nextPaymentDate: string | null
  isDone: boolean | null
  notes: string | null
  createdAt: string | null
}

interface ClientDetail {
  id: number
  name: string | null
  phone: string | null
  passport: string | null
  boardNumber: string | null
  visaNumber: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  cardType: string | null
  cardValue: number | null
  notes: string | null
  paymentType: string | null
  nextPaymentDate: string | null
  amount: number | null
  serviceId: number | null
  organizationId: number | null
  lastStepId: number | null
  service: { id: number; name: string | null } | null
  organization: { id: number; name: string | null } | null
  steps: ClientStep[]
  payments: ClientPayment[]
}

interface ServiceStep {
  id: number
  name: string | null
  order: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function clientToForm(c: ClientDetail): ClientFormData {
  return {
    name: c.name ?? '',
    phone: c.phone ?? '',
    passport: c.passport ?? '',
    iqamaNumber: c.iqamaNumber ?? '',
    iqamaEndDate: c.iqamaEndDate ? c.iqamaEndDate.slice(0, 10) : '',
    cardType: c.cardType ?? 'بدون',
    paymentType: c.paymentType ?? '',
    amount: c.amount != null ? String(c.amount) : '',
    serviceId: c.serviceId != null ? String(c.serviceId) : '',
    organizationId: c.organizationId != null ? String(c.organizationId) : '',
    boardNumber: c.boardNumber ?? '',
    visaNumber: c.visaNumber ?? '',
    receivedAmount: '',
    notes: c.notes ?? '',
    nextPaymentDate: c.nextPaymentDate ?? '',
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'

// ─── Delete confirm inline ────────────────────────────────────────────────────

function DeleteConfirm({
  onConfirm, onCancel, isPending,
}: { onConfirm: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onConfirm} disabled={isPending}
        className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                   rounded-lg px-3 py-1.5 transition-colors font-medium">
        {isPending ? '...' : 'نعم'}
      </button>
      <button onClick={onCancel}
        className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors font-medium">
        لا
      </button>
    </div>
  )
}

// ─── Iqama status badge ───────────────────────────────────────────────────────

function IqamaBadge({ dateStr }: { dateStr: string | null }) {
  const s = iqamaStatus(dateStr)
  if (!dateStr) return <span className="text-sm text-gray-400">—</span>

  const badgeCls = s.cls.includes('red')
    ? 'bg-red-100 text-red-700 border border-red-200'
    : s.cls.includes('amber')
    ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'

  return (
    <div className="flex flex-col gap-1">
      <span className={s.cls + ' text-sm font-medium'}>{s.label}</span>
      {s.extra && (
        <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls}`}>
          {s.extra}
        </span>
      )}
    </div>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-sky-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const clientId = Number(id)

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: client, isLoading, isError } = useQuery<ClientDetail>({
    queryKey: ['client', clientId],
    queryFn: () => apiFetch<ClientDetail>(`/api/clients/${clientId}`),
    enabled: !isNaN(clientId),
  })

  const { data: serviceSteps = [] } = useQuery<ServiceStep[]>({
    queryKey: ['service-steps', client?.serviceId ?? 0],
    queryFn: () =>
      apiFetch<ServiceStep[]>(`/api/service-steps?serviceId=${client!.serviceId}`),
    enabled: !!client?.serviceId,
  })

  const { data: services = [] } = useQuery<ServiceOption[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch<ServiceOption[]>('/api/services'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: organizations = [] } = useQuery<OrgOption[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgOption[]>('/api/organizations'),
    staleTime: 5 * 60 * 1000,
  })

  // ── edit state ───────────────────────────────────────────────────────────

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<ClientFormData>({
    name: '', phone: '', passport: '', iqamaNumber: '',
    iqamaEndDate: '', cardType: 'بدون', paymentType: '', amount: '',
    serviceId: '', organizationId: '', boardNumber: '', visaNumber: '',
    receivedAmount: '', notes: '', nextPaymentDate: '',
  })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [payErrors, setPayErrors] = useState<Record<string, string>>({})

  function openEdit() {
    if (!client) return
    setEditForm(clientToForm(client))
    setEditErrors({})
    setShowEdit(true)
  }

  // ── delete client ────────────────────────────────────────────────────────

  const [showDeleteClient, setShowDeleteClient] = useState(false)

  // ── steps state ──────────────────────────────────────────────────────────

  const [stepId, setStepId] = useState('')
  const [stepDate, setStepDate] = useState('')
  const [deleteStepId, setDeleteStepId] = useState<number | null>(null)

  // ── payments state ───────────────────────────────────────────────────────

  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payIsDone, setPayIsDone] = useState(true)
  const [payNotes, setPayNotes] = useState('')
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null)

  // ── mutations ────────────────────────────────────────────────────────────

  const updateClient = useMutation({
    mutationFn: (body: ReturnType<typeof buildClientPayload>) =>
      apiFetch<ClientDetail>(`/api/clients/${clientId}`, {
        method: 'PUT', body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setShowEdit(false)
    },
  })

  const deleteClient = useMutation({
    mutationFn: () => apiFetch<unknown>(`/api/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      navigate('/clients')
    },
  })

  const addStep = useMutation({
    mutationFn: (body: { clientId: number; stepId: number; stepDate?: string }) =>
      apiFetch<unknown>('/api/client-steps', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setStepId('')
      setStepDate('')
    },
  })

  const deleteStep = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/client-steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setDeleteStepId(null)
    },
  })

  const addPayment = useMutation({
    mutationFn: (body: {
      clientId: number; amount?: number; nextPaymentDate?: string;
      isDone: boolean; notes?: string;
    }) => apiFetch<unknown>('/api/client-payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPayAmount('')
      setPayDate('')
      setPayIsDone(true)
      setPayNotes('')
    },
  })

  const deletePayment = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/client-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeletePaymentId(null)
    },
  })

  // ── handlers ─────────────────────────────────────────────────────────────

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const errs = getErrors(clientSchema(false), editForm)
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return
    updateClient.mutate(buildClientPayload(editForm))
  }

  function handleAddStep(e: React.FormEvent) {
    e.preventDefault()
    const errs = getErrors(clientStepSchema, { stepId, stepDate })
    setStepErrors(errs)
    if (Object.keys(errs).length > 0) return
    addStep.mutate({ clientId, stepId: Number(stepId), stepDate: stepDate || undefined })
  }

  function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    const errs = getErrors(clientPaymentSchema, { amount: payAmount, nextPaymentDate: payDate })
    setPayErrors(errs)
    if (Object.keys(errs).length > 0) return
    addPayment.mutate({
      clientId,
      amount: payAmount ? Number(payAmount) : undefined,
      nextPaymentDate: payDate || undefined,
      isDone: payIsDone,
      notes: payNotes || undefined,
    })
  }

  // ── loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6 space-y-4 page-enter">
          {/* header skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-6 w-48 rounded-lg bg-gray-200 animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                    <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    )
  }

  if (isError || !client) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">تعذّر تحميل بيانات العميل</p>
          <button onClick={() => navigate('/clients')}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold
                       px-5 py-2.5 transition-colors">
            العودة للعملاء
          </button>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5 page-enter">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/clients')}
            className="rounded-xl p-2 text-gray-400 hover:text-gray-700 hover:bg-white
                       border border-transparent hover:border-gray-200 transition-all"
            aria-label="العودة"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {client.name ?? 'بيانات العميل'}
            </h2>
            {client.service?.name && (
              <p className="text-sm text-gray-500 mt-0.5">{client.service.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                         hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 min-h-10
                         transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              تعديل
            </button>

            {showDeleteClient ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <span className="text-xs text-red-700 font-medium whitespace-nowrap">تأكيد حذف العميل؟</span>
                <DeleteConfirm
                  onConfirm={() => deleteClient.mutate()}
                  onCancel={() => setShowDeleteClient(false)}
                  isPending={deleteClient.isPending}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteClient(true)}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white
                           hover:bg-red-50 text-red-600 text-sm font-medium px-4 py-2.5 min-h-10
                           transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف
              </button>
            )}
          </div>
        </div>

        {/* ── Info card ── */}
        <SectionCard title="البيانات الأساسية">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            {([
              { label: 'الاسم', value: client.name },
              { label: 'الهاتف', value: client.phone },
              { label: 'رقم الجواز', value: client.passport },
              { label: 'رقم الإقامة', value: client.iqamaNumber },
              {
                label: 'انتهاء الإقامة',
                custom: <IqamaBadge dateStr={client.iqamaEndDate} />,
              },
              { label: 'الخدمة', value: client.service?.name },
              { label: 'المؤسسة', value: client.organization?.name },
              { label: 'نوع الدفع', value: client.paymentType },
              {
                label: 'المبلغ',
                value: client.amount != null
                  ? `${client.amount.toLocaleString('ar-SA')} ر.س`
                  : null,
              },
              { label: 'كرت العمل', value: client.cardType },
              { label: 'رقم اللوحة', value: client.boardNumber },
              { label: 'رقم التأشيرة', value: client.visaNumber },
            ] as Array<{ label: string; value?: string | null; custom?: React.ReactNode }>)
              .map(({ label, value, custom }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-400 mb-1">{label}</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {custom ?? (value ?? '—')}
                  </dd>
                </div>
              ))}
          </dl>

          {client.notes && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <dt className="text-xs font-medium text-gray-400 mb-1.5">ملاحظات</dt>
              <dd className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{client.notes}</dd>
            </div>
          )}
        </SectionCard>

        {/* ── Service steps card ── */}
        <SectionCard title="خطوات الخدمة">
          {client.steps.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">لم تُسجَّل خطوات بعد</p>
            </div>
          ) : (
            <ul className="space-y-2 mb-5">
              {client.steps.map((s) => (
                <li key={s.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3
                             border border-gray-100">
                  <div className="flex items-center gap-3">
                    {s.step?.order != null && (
                      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7
                                       rounded-full bg-sky-100 text-sky-700 text-xs font-bold">
                        {s.step.order}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.step?.name ?? '—'}</p>
                      {s.stepDate && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.stepDate)}</p>
                      )}
                    </div>
                  </div>
                  {deleteStepId === s.id ? (
                    <DeleteConfirm
                      onConfirm={() => deleteStep.mutate(s.id)}
                      onCancel={() => setDeleteStepId(null)}
                      isPending={deleteStep.isPending}
                    />
                  ) : (
                    <button onClick={() => setDeleteStepId(s.id)} aria-label="حذف الخطوة"
                      className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {client.serviceId ? (
            <>
              <form onSubmit={handleAddStep}
                className="flex flex-col gap-2.5 border-t border-gray-100 pt-5">
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex-1 min-w-40">
                    <select value={stepId} onChange={(e) => setStepId(e.target.value)}
                      className={`w-full rounded-xl border bg-gray-50 px-3 py-2.5 text-sm
                                 focus:outline-none focus:ring-2 focus:bg-white min-h-11
                                 ${stepErrors.stepId
                                   ? 'border-red-400 focus:ring-red-400'
                                   : 'border-gray-300 focus:ring-sky-500'}`}>
                      <option value="">— اختر الخطوة —</option>
                      {serviceSteps.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.order != null ? `${st.order}. ` : ''}{st.name}
                        </option>
                      ))}
                    </select>
                    {stepErrors.stepId && <p className="mt-1 text-xs text-red-500">{stepErrors.stepId}</p>}
                  </div>
                  <div>
                    <input type="date" value={stepDate} onChange={(e) => setStepDate(e.target.value)}
                      className={`rounded-xl border bg-gray-50 px-3 py-2.5 text-sm
                                 focus:outline-none focus:ring-2 focus:bg-white min-h-11
                                 ${stepErrors.stepDate
                                   ? 'border-red-400 focus:ring-red-400'
                                   : 'border-gray-300 focus:ring-sky-500'}`} />
                    {stepErrors.stepDate && <p className="mt-1 text-xs text-red-500">{stepErrors.stepDate}</p>}
                  </div>
                  <button type="submit" disabled={addStep.isPending}
                    className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                               text-white text-sm font-semibold px-5 py-2.5 min-h-11 transition-colors self-start">
                    {addStep.isPending ? '...' : 'إضافة'}
                  </button>
                </div>
              </form>
              {addStep.isError && (
                <p className="text-xs text-red-600 mt-2">
                  {addStep.error instanceof Error ? addStep.error.message : 'حدث خطأ'}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4 mt-2">
              لا توجد خدمة مرتبطة بهذا العميل لإضافة خطوات
            </p>
          )}
        </SectionCard>

        {/* ── Payments card ── */}
        <SectionCard title="الدفعات">
          {client.payments.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">لم تُسجَّل دفعات بعد</p>
            </div>
          ) : (
            <ul className="space-y-2 mb-5">
              {client.payments.map((p) => (
                <li key={p.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3
                             border border-gray-100">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.isDone
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {p.isDone ? 'مكتملة' : 'معلقة'}
                    </span>
                    <div>
                      {p.amount != null && (
                        <p className="text-sm font-bold text-gray-900">
                          {p.amount.toLocaleString('ar-SA')} ر.س
                        </p>
                      )}
                      {p.nextPaymentDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          الدفعة التالية: {formatDate(p.nextPaymentDate)}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>
                      )}
                    </div>
                  </div>
                  {deletePaymentId === p.id ? (
                    <DeleteConfirm
                      onConfirm={() => deletePayment.mutate(p.id)}
                      onCancel={() => setDeletePaymentId(null)}
                      isPending={deletePayment.isPending}
                    />
                  ) : (
                    <button onClick={() => setDeletePaymentId(p.id)} aria-label="حذف الدفعة"
                      className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add payment form */}
          <form onSubmit={handleAddPayment} className="border-t border-gray-100 pt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">المبلغ (ر.س)</label>
                <input type="number" min={0} value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00"
                  className={`${inputCls}${payErrors.amount ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                {payErrors.amount && <p className="mt-1 text-xs text-red-500">{payErrors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">تاريخ الدفعة التالية</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className={`${inputCls}${payErrors.nextPaymentDate ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                {payErrors.nextPaymentDate && <p className="mt-1 text-xs text-red-500">{payErrors.nextPaymentDate}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">ملاحظات</label>
              <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                placeholder="ملاحظات اختيارية"
                className={inputCls} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={payIsDone} onChange={(e) => setPayIsDone(e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-500" />
                تم استلام الدفعة
              </label>
              <button type="submit" disabled={addPayment.isPending}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold px-5 py-2.5 min-h-11 transition-colors">
                {addPayment.isPending ? '...' : 'تسجيل دفعة'}
              </button>
            </div>
            {addPayment.isError && (
              <p className="text-xs text-red-600">
                {addPayment.error instanceof Error ? addPayment.error.message : 'حدث خطأ'}
              </p>
            )}
          </form>
        </SectionCard>

      </main>

      {/* ── Edit modal ── */}
      {showEdit && (
        <Modal title="تعديل بيانات العميل" size="lg" onClose={() => { setShowEdit(false); setEditErrors({}) }}>
          <form onSubmit={handleEdit} className="space-y-4">
            <ClientFormFields
              form={editForm}
              onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
              services={services}
              organizations={organizations}
              errors={editErrors}
            />

            {updateClient.isError && (
              <p className="text-sm text-red-600">
                {updateClient.error instanceof Error ? updateClient.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowEdit(false)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={updateClient.isPending}
                className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-11 transition-colors">
                {updateClient.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
