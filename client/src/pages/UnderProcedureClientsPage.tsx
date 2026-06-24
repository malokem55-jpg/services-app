import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import {
  type ClientFormData,
  type ServiceOption,
  type OrgOption,
  type ServiceStepOption,
  type StepFormEntry,
  type ArrivalPlaceOption,
  EMPTY_CLIENT_FORM,
  buildClientPayload,
  tafweedAlertErrors,
  tafweedDisplayValue,
} from '../lib/clientForm'
import { clientSchema, clientStepSchema, getErrors } from '../lib/schemas'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import ClientFormFields from '../components/ClientFormFields'
import HijriDateInput from '../components/HijriDateInput'
import MonthlyPaymentsPanel from '../components/MonthlyPaymentsPanel'
import CopyButton from '../components/CopyButton'

interface ClientListItem {
  id: number
  name: string | null
  phone: string | null
  passport: string | null
  iqamaNumber: string | null
  boardNumber: string | null
  cardType: string | null
  paymentType: string | null
  organization: { id: number; name: string | null; number: string | null } | null
  arrivalPlace: { id: number; name: string } | null
  steps: Array<{ step: { id: number; name: string | null } | null }>
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
  paymentType: string | null
  amount: number | null
  nextPaymentDate: string | null
  tafweedAlertDate: string | null
  tafweedDone: boolean | null
  service: { id: number; name: string | null } | null
  organization: { id: number; name: string | null } | null
  arrivalPlace: { id: number; name: string } | null
  steps: Array<{
    id: number
    stepDate: string | null
    step: { id: number; name: string | null; number: string | null; order: number | null } | null
  }>
  payments: Array<{
    id: number
    amount: number | null
    isDone: boolean | null
    nextPaymentDate: string | null
    notes: string | null
    createdAt: string | null
  }>
  paymentMonthlies: Array<{
    id: number
    receivedDate: string | null
    status: string | null
  }>
}

/* ─── shared input style ─────────────────────────────────────────────────── */
const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11'

/* ─── Inline modal shell (replicates Modal layout without the component) ─── */
function InlineModal({
  title, onClose, children, maxWidth = 'sm:max-w-2xl',
}: { title: string; onClose: () => void; children: ReactNode; maxWidth?: string }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] backdrop-enter" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-white w-full ${maxWidth}
                    rounded-t-3xl sm:rounded-2xl shadow-2xl
                    max-h-[92dvh] overflow-hidden flex flex-col
                    slide-up sm:modal-enter`}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق"
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ─── Main page component ────────────────────────────────────────────────── */
export default function UnderProcedureClientsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [nameSearch, setNameSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [stepFilter, setStepFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [modalView, setModalView] = useState<'detail' | 'payments' | 'steps' | 'issue-iqama'>('detail')
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [deletePayId, setDeletePayId] = useState<number | null>(null)
  const [form, setForm] = useState<ClientFormData>(EMPTY_CLIENT_FORM)
  const [stepEntries, setStepEntries] = useState<StepFormEntry[]>([])
  const [newStepId, setNewStepId] = useState('')
  const [newStepDate, setNewStepDate] = useState('')
  const [issueNumber, setIssueNumber] = useState('')
  const [issueEndDate, setIssueEndDate] = useState('')
  const [issueSubmitAttempted, setIssueSubmitAttempted] = useState(false)
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [addStepErrors, setAddStepErrors] = useState<Record<string, string>>({})

  // فتح صفحة تفاصيل العميل مع تمرير الصفحة المصدر لتمييزها في الشريط وللرجوع إليها
  function openDetailPage(id: number) {
    navigate(`/clients/${id}`, { state: { from: '/under-procedure-clients' } })
  }

  function closeDetail() {
    setDetailId(null)
    setModalView('detail')
    setPayAmount('')
    setPayNotes('')
    setDeletePayId(null)
    setNewStepId('')
    setNewStepDate('')
    setIssueNumber('')
    setIssueEndDate('')
    setIssueSubmitAttempted(false)
    setAddStepErrors({})
  }

  function setField(field: keyof ClientFormData, value: string) {
    if (field === 'serviceId') {
      setStepEntries([])
      setForm((prev) => ({ ...prev, serviceId: value, paymentType: '' }))
      return
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleStepChange(stepId: number, field: 'date' | 'done', value: string | boolean) {
    setStepEntries((prev) => prev.map((e) => e.stepId === stepId ? { ...e, [field]: value } : e))
  }

  const { data: clients = [], isLoading, isError } = useQuery<ClientListItem[]>({
    queryKey: ['clients'],
    queryFn: () => apiFetch<ClientListItem[]>('/api/clients'),
    staleTime: 30 * 1000,
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

  const { data: arrivalPlaces = [] } = useQuery<ArrivalPlaceOption[]>({
    queryKey: ['arrival-places'],
    queryFn: () => apiFetch<ArrivalPlaceOption[]>('/api/arrival-places'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: serviceSteps = [] } = useQuery<ServiceStepOption[]>({
    queryKey: ['service-steps', form.serviceId],
    queryFn: () => apiFetch<ServiceStepOption[]>(`/api/service-steps?serviceId=${form.serviceId}`),
    enabled: !!form.serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: detailClient, isLoading: detailLoading } = useQuery<ClientDetail>({
    queryKey: ['client', detailId],
    queryFn: () => apiFetch<ClientDetail>(`/api/clients/${detailId}`),
    enabled: detailId !== null,
  })

  const detailServiceId = detailClient?.service?.id
  const { data: detailServiceSteps = [] } = useQuery<ServiceStepOption[]>({
    queryKey: ['service-steps', detailServiceId],
    queryFn: () => apiFetch<ServiceStepOption[]>(`/api/service-steps?serviceId=${detailServiceId}`),
    enabled: !!detailServiceId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (serviceSteps.length === 0) return
    setStepEntries(serviceSteps.map((s) => ({ stepId: s.id, date: '', done: false })))
    setForm((prev) => ({ ...prev, paymentType: 'سنوي' }))
  }, [serviceSteps])

  const { data: allServiceSteps = [] } = useQuery<Array<ServiceStepOption & { serviceId: number | null }>>({
    queryKey: ['service-steps-all'],
    queryFn: () => apiFetch<Array<ServiceStepOption & { serviceId: number | null }>>('/api/service-steps'),
    staleTime: 5 * 60 * 1000,
  })

  // عملية الإضافة هنا دائماً "إصدار إقامة جديدة" = أول خدمة تملك خطوات —
  // تُحدد تلقائياً عند فتح النافذة فلا يُسأل المستخدم عن العملية
  const iqamaServiceId = useMemo(() => {
    const serviceIdsWithSteps = new Set(
      allServiceSteps.map((s) => s.serviceId).filter((id): id is number => id != null),
    )
    const iqamaService = services.find((s) => serviceIdsWithSteps.has(s.id))
    return iqamaService ? String(iqamaService.id) : ''
  }, [services, allServiceSteps])

  function openAdd() {
    setForm({ ...EMPTY_CLIENT_FORM, serviceId: iqamaServiceId })
    setStepEntries([])
    setAddErrors({})
    setShowAdd(true)
  }

  // الصفحة مخصصة للعملاء تحت الإجراء فقط — كل من لم يصدر له رقم إقامة بعد
  const underProcedureClients = useMemo(
    () => clients.filter((c) => !c.iqamaNumber),
    [clients],
  )

  const filteredClients = useMemo(() => {
    return underProcedureClients.filter((c) => {
      if (nameSearch && !c.name?.includes(nameSearch)) return false
      if (orgFilter && String(c.organization?.id ?? '') !== orgFilter) return false
      if (stepFilter && String(c.steps[0]?.step?.id ?? '') !== stepFilter) return false
      return true
    })
  }, [underProcedureClients, nameSearch, orgFilter, stepFilter])

  const hasFilters = nameSearch || orgFilter || stepFilter

  const addPayment = useMutation({
    mutationFn: (body: { clientId: number; amount?: number; isDone: boolean; notes?: string }) =>
      apiFetch<unknown>('/api/client-payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPayAmount('')
      setPayNotes('')
    },
  })

  const deletePayment = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/api/client-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeletePayId(null)
    },
  })

  const addStep = useMutation({
    mutationFn: (body: { clientId: number; stepId: number; stepDate?: string }) =>
      apiFetch<unknown>('/api/client-steps', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setNewStepId('')
      setNewStepDate('')
    },
  })

  // إصدار الإقامة يجعل العميل "مكتملاً" فيختفي من هذه الصفحة ويظهر في صفحة العملاء
  const issueIqama = useMutation({
    mutationFn: (body: { iqamaNumber?: string; iqamaEndDate?: string }) =>
      apiFetch<unknown>(`/api/clients/${detailId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', detailId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      closeDetail()
    },
  })

  function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!detailId) return
    addPayment.mutate({
      clientId: detailId,
      amount: payAmount ? Number(payAmount) : undefined,
      isDone: true,
      notes: payNotes || undefined,
    })
  }

  function handleAddStep(e: React.FormEvent) {
    e.preventDefault()
    const errs = getErrors(clientStepSchema, { stepId: newStepId, stepDate: newStepDate })
    setAddStepErrors(errs)
    if (!detailId || Object.keys(errs).length > 0) return
    addStep.mutate({
      clientId: detailId,
      stepId: Number(newStepId),
      stepDate: newStepDate || undefined,
    })
  }

  function handleIssueIqama(e: React.FormEvent) {
    e.preventDefault()
    setIssueSubmitAttempted(true)
    if (!detailId || !issueNumber || !issueEndDate) return
    issueIqama.mutate({
      iqamaNumber: issueNumber,
      iqamaEndDate: issueEndDate,
    })
  }

  const createClient = useMutation({
    mutationFn: async (body: ReturnType<typeof buildClientPayload>) => {
      const client = await apiFetch<ClientListItem>('/api/clients', { method: 'POST', body: JSON.stringify(body) })
      const stepsToSave = stepEntries.filter((e) => e.done || e.date)
      for (const entry of stepsToSave) {
        await apiFetch('/api/client-steps', {
          method: 'POST',
          body: JSON.stringify({ clientId: client.id, stepId: entry.stepId, stepDate: entry.date || undefined }),
        })
      }
      if (form.paymentType === 'سنوي' && form.receivedAmount && Number(form.receivedAmount) > 0) {
        await apiFetch('/api/client-payments', {
          method: 'POST',
          body: JSON.stringify({
            clientId: client.id,
            amount: Number(form.receivedAmount),
            isDone: true,
            notes: form.notes || undefined,
          }),
        })
      }
      return client
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setShowAdd(false)
      setForm(EMPTY_CLIENT_FORM)
      setStepEntries([])
      setAddErrors({})
    },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const isIqama = serviceSteps.length > 0
    const errs = { ...getErrors(clientSchema(isIqama, true), form), ...tafweedAlertErrors(form) }
    setAddErrors(errs)
    if (Object.keys(errs).length > 0) return
    createClient.mutate(buildClientPayload(form))
  }

  const paidAmount = detailClient?.payments
    .filter((p) => p.isDone)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0
  const remaining = (detailClient?.amount ?? 0) - paidAmount
  const isMonthly = detailClient?.paymentType === 'شهري'
  // للعميل الشهري: الدفعة القادمة هي أقرب دفعية مستحقة من جدول الأقساط
  const nextMonthlyDue = (detailClient?.paymentMonthlies ?? [])
    .filter((m) => m.status !== 'paid' && m.receivedDate)
    .map((m) => (m.receivedDate as string).slice(0, 10))
    .sort()[0] ?? null
  const currentStep = detailClient?.steps[0]?.step?.name ?? '—'

  /* ─── Shared form field style ── */
  const fldCls = inputCls + ' border-gray-300 bg-gray-50 focus:bg-white'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-gray-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-4 page-enter
                       md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-4 md:shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">العملاء تحت الإجراء</h2>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredClients.length} عميل
                {hasFilters ? ' (مفلتر)' : ''}
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
            <span>إضافة عميل</span>
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 md:shrink-0">
          <div className="relative">
            <svg className="pointer-events-none absolute inset-y-0 inset-e-3 my-auto w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
              placeholder="بحث بالاسم..."
              className="w-full rounded-xl border border-gray-200 bg-white pe-10 ps-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11" />
          </div>

          <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className={inputCls}>
            <option value="">كل المؤسسات</option>
            {organizations.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.name}</option>
            ))}
          </select>

          <select value={stepFilter} onChange={(e) => setStepFilter(e.target.value)} className={inputCls}>
            <option value="">كل الخطوات</option>
            {allServiceSteps.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>

        {isError && (
          <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل العملاء، حاول تحديث الصفحة.
          </div>
        )}

        {/* ── Mobile: card list ── */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">
                {hasFilters ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء تحت الإجراء'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {hasFilters ? 'جرّب تغيير الفلاتر' : 'كل العملاء مكتملون'}
              </p>
            </div>
          ) : (
            filteredClients.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                           active:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => openDetailPage(c.id)}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{c.name ?? '—'}</p>
                    <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                      تحت الإجراء
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    {c.phone && <span className="font-mono">{c.phone}</span>}
                    {c.passport && <span className="font-mono">جواز: {c.passport}</span>}
                    {c.organization?.name && (
                      <span className="truncate">{c.organization.name}</span>
                    )}
                    {c.steps[0]?.step?.name && (
                      <span className="truncate">الخطوة: {c.steps[0].step.name}</span>
                    )}
                  </div>
                </div>

                {/* Card actions */}
                <div className="flex border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setDetailId(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                               text-sky-600 hover:bg-sky-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    التفاصيل
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={() => { setDetailId(c.id); setModalView('issue-iqama') }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                               text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    إصدار الإقامة
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم العميل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم المؤسسة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم المؤسسة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم الجواز</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم الحدود</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">جهة القدوم</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">إصدار إقامة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {[40, 28, 20, 28, 24, 24, 16, 16].map((w, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 3}px` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">
                          {hasFilters ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا يوجد عملاء تحت الإجراء'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 hover:bg-sky-50/40 cursor-pointer transition-colors"
                      onClick={() => openDetailPage(c.id)}
                    >
                      <td className="px-4 py-2.5 font-semibold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{c.name ?? '—'}</span>
                          {c.name && <CopyButton value={c.name} label="اسم العميل" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          <span>{c.organization?.name ?? '—'}</span>
                          {c.organization?.name && <CopyButton value={c.organization.name} label="اسم المؤسسة" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400 tracking-wide">
                        <div className="flex items-center gap-1.5">
                          <span>{c.organization?.number ?? '—'}</span>
                          {c.organization?.number && <CopyButton value={c.organization.number} label="رقم المؤسسة" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">
                        <div className="flex items-center gap-1.5">
                          <span>{c.passport ?? '—'}</span>
                          {c.passport && <CopyButton value={c.passport} label="رقم الجواز" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">
                        <div className="flex items-center gap-1.5">
                          <span>{c.boardNumber ?? '—'}</span>
                          {c.boardNumber && <CopyButton value={c.boardNumber} label="رقم الحدود" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-sm">
                        <div className="flex items-center gap-1.5">
                          <span>{c.arrivalPlace?.name ?? '—'}</span>
                          {c.arrivalPlace?.name && <CopyButton value={c.arrivalPlace.name} label="جهة القدوم" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.id); setModalView('issue-iqama') }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700
                                     bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          إصدار
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.id) }}
                          aria-label="عرض التفاصيل"
                          className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                     hover:bg-sky-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── Detail modal ─────────────────────────────────────────────────────── */}
      {detailId !== null && modalView === 'detail' && (
        <InlineModal title="تفاصيل عميل (تحت الإجراء)" onClose={closeDetail}>
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : detailClient ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 mb-5">
                {[
                  { label: 'اسم العميل', val: detailClient.name },
                  { label: 'رقم الهاتف', val: detailClient.phone },
                  { label: 'المؤسسة', val: detailClient.organization?.name },
                  { label: 'رقم الجواز', val: detailClient.passport },
                  { label: 'رقم الحدود', val: detailClient.boardNumber },
                  { label: 'رقم التأشيرة', val: detailClient.visaNumber },
                  { label: 'جهة القدوم', val: detailClient.arrivalPlace?.name },
                  { label: 'الخطوة الحالية', val: currentStep },
                  { label: 'تاريخ تنبيه التفويض والتصديق',
                    val: tafweedDisplayValue(detailClient.tafweedAlertDate, detailClient.tafweedDone) },
                  { label: 'تاريخ الدفعة القادمة', val: isMonthly ? nextMonthlyDue : detailClient.nextPaymentDate?.slice(0, 10) },
                  { label: 'طريقة الدفع', val: detailClient.paymentType },
                  { label: 'المبلغ الإجمالي', val: detailClient.amount != null ? detailClient.amount.toLocaleString('en-US') : null },
                  { label: 'المبلغ المدفوع', val: paidAmount.toLocaleString('en-US') },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{val ?? '—'}</p>
                  </div>
                ))}
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
                <p className="text-lg font-bold text-sky-700">{remaining.toLocaleString('en-US')}</p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button onClick={() => setModalView('steps')}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  الخطوات
                </button>
                <button onClick={() => setModalView('payments')}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  الدفعيات
                </button>
                <button onClick={() => setModalView('issue-iqama')}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  إصدار الإقامة
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button onClick={closeDetail}
                  className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                             text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
                  إغلاق
                </button>
              </div>
            </>
          ) : null}
        </InlineModal>
      )}

      {/* ─── Steps modal ──────────────────────────────────────────────────────── */}
      {detailId !== null && modalView === 'steps' && detailClient && (
        <InlineModal title="إضافة خطوة" onClose={closeDetail}>
          <form onSubmit={handleAddStep} className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className={labelCls}>الخطوة</label>
                <select value={newStepId} onChange={(e) => setNewStepId(e.target.value)}
                  className={`${fldCls}${addStepErrors.stepId ? ' border-red-400! focus:ring-red-400!' : ''}`}>
                  <option value="">اختر الخطوة...</option>
                  {detailServiceSteps.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
                {addStepErrors.stepId && <p className="mt-1 text-xs text-red-500">{addStepErrors.stepId}</p>}
              </div>
              <div>
                <label className={labelCls}>التاريخ</label>
                <input type="date" value={newStepDate} onChange={(e) => setNewStepDate(e.target.value)}
                  className={`${fldCls}${addStepErrors.stepDate ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                {addStepErrors.stepDate && <p className="mt-1 text-xs text-red-500">{addStepErrors.stepDate}</p>}
              </div>
            </div>
            <button type="submit" disabled={addStep.isPending}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-sm font-semibold px-8 py-2.5 transition-colors">
              {addStep.isPending ? '...' : 'حفظ'}
            </button>
          </form>

          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-600 text-white text-right">
                  <th className="px-4 py-3 text-xs font-semibold">الخطوة</th>
                  <th className="px-4 py-3 text-xs font-semibold">رقم الخطوة</th>
                  <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {detailClient.steps.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                      لا توجد خطوات مسجلة
                    </td>
                  </tr>
                ) : (
                  detailClient.steps.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{s.step?.name ?? '—'}</span>
                          {s.step?.name && <CopyButton value={s.step.name} label="الخطوة" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{s.step?.number ?? '—'}</span>
                          {s.step?.number != null && <CopyButton value={String(s.step.number)} label="رقم الخطوة" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{s.stepDate ? s.stepDate.slice(0, 10) : '—'}</span>
                          {s.stepDate && <CopyButton value={s.stepDate.slice(0, 10)} label="التاريخ" />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setModalView('detail')}
              className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                         text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
              رجوع
            </button>
          </div>
        </InlineModal>
      )}

      {/* ─── Payments modal ───────────────────────────────────────────────────── */}
      {detailId !== null && modalView === 'payments' && detailClient && (() => {
        const isMonthlyPay = detailClient.paymentType === 'شهري'
        return (
          <InlineModal title={isMonthlyPay ? 'الدفعيات الشهرية' : 'الدفعيات السنوية'} onClose={closeDetail}
            maxWidth={isMonthlyPay ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}>
            {isMonthlyPay && (
              <MonthlyPaymentsPanel clientId={detailClient.id} monthlyAmount={detailClient.amount} />
            )}
            {!isMonthlyPay && remaining > 0 && (
              <form onSubmit={handleAddPayment} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-3">
                  تسجيل دفعة (المتبقي: {remaining.toLocaleString('en-US')})
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>المبلغ المستلم</label>
                    <input type="number" min={1} max={remaining} value={payAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val > remaining) setPayAmount(String(remaining))
                        else setPayAmount(e.target.value)
                      }}
                      className={fldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ملاحظات</label>
                    <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className={fldCls} />
                  </div>
                </div>
                <button type="submit"
                  disabled={addPayment.isPending || !payAmount || Number(payAmount) <= 0 || Number(payAmount) > remaining}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                             text-white text-sm font-semibold px-8 py-2.5 transition-colors">
                  {addPayment.isPending ? '...' : 'حفظ'}
                </button>
              </form>
            )}

            {!isMonthlyPay && remaining <= 0 && (
              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center font-medium">
                تم استلام المبلغ الإجمالي كاملاً
              </div>
            )}

            {!isMonthlyPay && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-600 text-white text-right">
                    <th className="px-4 py-3 text-xs font-semibold">المبلغ</th>
                    <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
                    <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {detailClient.payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                        لا توجد دفعات مسجلة
                      </td>
                    </tr>
                  ) : (
                    detailClient.payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            <span>{p.amount != null ? p.amount.toLocaleString('en-US') : '—'}</span>
                            {p.amount != null && <CopyButton value={p.amount.toLocaleString('en-US')} label="المبلغ" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <span>{p.createdAt ? p.createdAt.slice(0, 10) : '—'}</span>
                            {p.createdAt && <CopyButton value={p.createdAt.slice(0, 10)} label="التاريخ" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>{p.notes ?? ''}</span>
                            {p.notes && <CopyButton value={p.notes} label="ملاحظات" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {deletePayId === p.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => deletePayment.mutate(p.id)} disabled={deletePayment.isPending}
                                className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-60
                                           rounded-lg px-2.5 py-1.5 transition-colors">
                                {deletePayment.isPending ? '...' : 'نعم'}
                              </button>
                              <button onClick={() => setDeletePayId(null)}
                                className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                                لا
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletePayId(p.id)}
                              className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setModalView('detail')}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-600 text-sm font-medium px-5 py-2.5 transition-colors">
                رجوع
              </button>
            </div>
          </InlineModal>
        )
      })()}

      {/* ─── Issue Iqama modal ────────────────────────────────────────────────── */}
      {detailId !== null && modalView === 'issue-iqama' && (
        <InlineModal title="إصدار رقم إقامة للعميل" onClose={closeDetail} maxWidth="sm:max-w-lg">
          <form onSubmit={handleIssueIqama}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>رقم الإقامة</label>
                <input type="text" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)}
                  className={`${fldCls} ${issueSubmitAttempted && !issueNumber ? 'border-red-400 focus:ring-red-400' : ''}`} />
                {issueSubmitAttempted && !issueNumber && (
                  <p className="text-xs text-red-500 mt-1">رقم الإقامة مطلوب</p>
                )}
              </div>
              <div>
                <label className={labelCls}>تاريخ انتهاء الإقامة</label>
                <HijriDateInput
                  value={issueEndDate}
                  onChange={setIssueEndDate}
                  defaultMode="hijri"
                  hasError={issueSubmitAttempted && !issueEndDate}
                />
                {issueSubmitAttempted && !issueEndDate && (
                  <p className="text-xs text-red-500 mt-1">التاريخ مطلوب</p>
                )}
              </div>
            </div>

            <p className="mb-5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs text-emerald-700">
              بعد إصدار الإقامة سينتقل العميل تلقائياً إلى صفحة العملاء (المكتملين).
            </p>

            {issueIqama.isError && (
              <p className="text-sm text-red-600 mb-4">
                {issueIqama.error instanceof Error ? issueIqama.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setModalView('detail')}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium px-5 py-2.5 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={issueIqama.isPending}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                           text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                {issueIqama.isPending ? '...' : 'حفظ'}
              </button>
            </div>
          </form>
        </InlineModal>
      )}

      {/* ─── Add client modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal
          title="إضافة عميل جديد"
          size="lg"
          onClose={() => { setShowAdd(false); setForm(EMPTY_CLIENT_FORM); setStepEntries([]); setAddErrors({}) }}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <ClientFormFields
              form={form}
              onChange={setField}
              services={services}
              organizations={organizations}
              serviceSteps={serviceSteps}
              stepEntries={stepEntries}
              onStepChange={handleStepChange}
              errors={addErrors}
              hideServicePicker={!!iqamaServiceId}
              arrivalPlaces={arrivalPlaces}
            />

            {createClient.isError && (
              <p className="text-sm text-red-600">
                {createClient.error instanceof Error ? createClient.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => { setShowAdd(false); setForm(EMPTY_CLIENT_FORM); setStepEntries([]) }}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={createClient.isPending}
                className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-11 transition-colors">
                {createClient.isPending ? 'جارٍ الإضافة...' : 'إضافة'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
