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
  iqamaStatus,
  tafweedDisplayValue,
} from '../lib/clientForm'
import { clientSchema, clientStepSchema, getErrors } from '../lib/schemas'
import { formatBothDates } from '../lib/hijri'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import ClientFormFields from '../components/ClientFormFields'
import HijriDateInput from '../components/HijriDateInput'
import MonthlyPaymentsPanel from '../components/MonthlyPaymentsPanel'
import ClientCardIssuancesModal from '../components/ClientCardIssuancesModal'
import { useUiSettings } from '../hooks/useUiSettings'

interface ClientListItem {
  id: number
  name: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  boardNumber: string | null
  cardType: string | null
  paymentType: string | null
  organization: { id: number; name: string | null; number: string | null } | null
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

/* ─── Iqama status badge ─────────────────────────────────────────────────── */
function IqamaBadge({ dateStr }: { dateStr: string | null }) {
  const s = iqamaStatus(dateStr)
  if (!dateStr) return <span className="text-gray-400 text-sm">—</span>

  const badgeCls = s.cls.includes('red')
    ? 'bg-red-100 text-red-700 border border-red-200'
    : s.cls.includes('amber')
    ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{s.label}</span>
      {s.extra && (
        <span className={`inline-flex items-center self-start rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls}`}>
          {s.extra}
        </span>
      )}
    </div>
  )
}

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
export default function ClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [nameSearch, setNameSearch] = useState('')
  const [iqamaSearch, setIqamaSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [stepFilter, setStepFilter] = useState('')
  // الافتراضي حسب ضبط الصفحات: «المكتملين» إذا كانت صفحة تحت الإجراء مفعّلة
  // (لأن إدارتهم في صفحتهم المستقلة)، و«كل العملاء» إذا كانت معطّلة
  const { data: uiSettings } = useUiSettings()
  const [clientTypeFilterOverride, setClientTypeFilterOverride] = useState<string | null>(null)
  const clientTypeFilter =
    clientTypeFilterOverride ?? (uiSettings?.showUnderProcedurePage === false ? '' : 'completed')
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [modalView, setModalView] = useState<'detail' | 'payments' | 'steps' | 'issue-iqama'>('detail')
  const [showCards, setShowCards] = useState(false)
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
  const [renewalId, setRenewalId] = useState<number | null>(null)
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewAmount, setRenewAmount] = useState('')
  const [renewReceivedAmount, setRenewReceivedAmount] = useState('')
  const [renewDayOfMonth, setRenewDayOfMonth] = useState('')
  const [renewNotes, setRenewNotes] = useState('')
  const [renewSubmitAttempted, setRenewSubmitAttempted] = useState(false)

  function closeDetail() {
    setDetailId(null)
    setModalView('detail')
    setShowCards(false)
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

  function closeRenewal() {
    setRenewalId(null)
    setRenewEndDate('')
    setRenewAmount('')
    setRenewReceivedAmount('')
    setRenewDayOfMonth('')
    setRenewNotes('')
    setRenewSubmitAttempted(false)
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

  const { data: allServiceSteps = [] } = useQuery<ServiceStepOption[]>({
    queryKey: ['service-steps-all'],
    queryFn: () => apiFetch<ServiceStepOption[]>('/api/service-steps'),
    staleTime: 5 * 60 * 1000,
  })

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (nameSearch && !c.name?.includes(nameSearch)) return false
      if (iqamaSearch && !c.iqamaNumber?.includes(iqamaSearch)) return false
      if (orgFilter && String(c.organization?.id ?? '') !== orgFilter) return false
      if (stepFilter && String(c.steps[0]?.step?.id ?? '') !== stepFilter) return false
      if (clientTypeFilter === 'under-procedure' && c.iqamaNumber) return false
      if (clientTypeFilter === 'completed' && !c.iqamaNumber) return false
      return true
    })
  }, [clients, nameSearch, iqamaSearch, orgFilter, stepFilter, clientTypeFilter])

  const hasFilters = nameSearch || iqamaSearch || orgFilter || stepFilter || clientTypeFilter

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
      setNewStepId('')
      setNewStepDate('')
    },
  })

  const issueIqama = useMutation({
    mutationFn: (body: { iqamaNumber?: string; iqamaEndDate?: string }) =>
      apiFetch<unknown>(`/api/clients/${detailId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', detailId] })
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

  const renewIqama = useMutation({
    mutationFn: async (body: {
      clientId: number
      iqamaEndDate: string
      amount: number
      isMonthly: boolean
      receivedAmount?: number
      dayOfMonth?: number
      notes?: string
    }) => {
      // للعميل الشهري: السيرفر يستكمل جدول الدفعيات تلقائياً حتى تاريخ الانتهاء الجديد
      const clientUpdate: Record<string, unknown> = { iqamaEndDate: body.iqamaEndDate, amount: body.amount }
      if (body.isMonthly && body.dayOfMonth) {
        clientUpdate.boardNumber = String(body.dayOfMonth)
      }
      await apiFetch<unknown>(`/api/clients/${body.clientId}`, {
        method: 'PUT',
        body: JSON.stringify(clientUpdate),
      })
      if (!body.isMonthly && body.receivedAmount && body.receivedAmount > 0) {
        await apiFetch<unknown>('/api/client-payments', {
          method: 'POST',
          body: JSON.stringify({ clientId: body.clientId, amount: body.receivedAmount, isDone: true, notes: body.notes }),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', renewalId] })
      qc.invalidateQueries({ queryKey: ['client-payment-monthlies'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      closeRenewal()
    },
  })

  function handleRenewIqama(e: React.FormEvent) {
    e.preventDefault()
    setRenewSubmitAttempted(true)
    const renewalClient = clients.find((c) => c.id === renewalId)
    const isMonthly = renewalClient?.paymentType === 'شهري'
    if (!renewalId || !renewEndDate || !renewAmount) return
    renewIqama.mutate({
      clientId: renewalId,
      iqamaEndDate: renewEndDate,
      amount: Number(renewAmount),
      isMonthly,
      receivedAmount: renewReceivedAmount ? Number(renewReceivedAmount) : undefined,
      dayOfMonth: renewDayOfMonth ? Number(renewDayOfMonth) : undefined,
      notes: renewNotes || undefined,
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
    const errs = getErrors(clientSchema(isIqama, true), form)
    setAddErrors(errs)
    if (Object.keys(errs).length > 0) return
    createClient.mutate(buildClientPayload(form))
  }

  const isUnderProcedure = detailClient ? !detailClient.iqamaNumber : false
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
            <h2 className="text-xl font-bold text-gray-900">العملاء</h2>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredClients.length} عميل
                {hasFilters ? ' (مفلتر)' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4 md:shrink-0">
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

          <div className="relative">
            <svg className="pointer-events-none absolute inset-y-0 inset-e-3 my-auto w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" value={iqamaSearch} onChange={(e) => setIqamaSearch(e.target.value)}
              placeholder="بحث برقم الإقامة..."
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

          <select value={clientTypeFilter} onChange={(e) => setClientTypeFilterOverride(e.target.value)} className={inputCls}>
            <option value="">الكل</option>
            <option value="under-procedure">تحت الإجراء</option>
            <option value="completed">المكتملين</option>
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
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">
                {hasFilters ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء بعد'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {hasFilters ? 'جرّب تغيير الفلاتر' : 'أضف أول عميل للبدء'}
              </p>
            </div>
          ) : (
            filteredClients.map((c) => {
              const iqama = iqamaStatus(c.iqamaEndDate)
              const badgeCls = c.iqamaEndDate
                ? (iqama.cls.includes('red') ? 'bg-red-100 text-red-700' : iqama.cls.includes('amber') ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                : 'bg-gray-100 text-gray-500'

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                             active:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/clients/${c.id}`, { state: { from: '/clients' } })}
                >
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{c.name ?? '—'}</p>
                      {c.iqamaNumber ? (
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                          {iqama.extra ?? 'ساري'}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                          تحت الإجراء
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                      {c.iqamaNumber && (
                        <span className="font-mono">{c.iqamaNumber}</span>
                      )}
                      {c.organization?.name && (
                        <span className="truncate">{c.organization.name}</span>
                      )}
                      {c.cardType && c.cardType !== 'بدون' && (
                        <span>كرت: {c.cardType}</span>
                      )}
                      {iqama.label !== '—' && (
                        <span className={iqama.cls.includes('red') ? 'text-red-600' : iqama.cls.includes('amber') ? 'text-amber-600' : 'text-gray-500'}>
                          {iqama.label}
                        </span>
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
                    {c.iqamaNumber && (
                      <>
                        <div className="w-px bg-gray-100" />
                        <button
                          onClick={() => setRenewalId(c.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                                     text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          تجديد
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم العميل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم الإقامة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">انتهاء الإقامة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">كرت العمل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">المؤسسة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم السجل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">تجديد</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {[40, 28, 32, 20, 24, 20, 16, 16].map((w, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className={`h-4 bg-gray-100 rounded animate-pulse`} style={{ width: `${w * 3}px` }} />
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
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">
                          {hasFilters ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا يوجد عملاء مضافون بعد'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-gray-100 hover:bg-sky-50/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/clients/${c.id}`, { state: { from: '/clients' } })}
                      >
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{c.name ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">
                          {c.iqamaNumber ?? (
                            <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700
                                             px-2 py-0.5 text-xs font-semibold">
                              تحت الإجراء
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <IqamaBadge dateStr={c.iqamaEndDate} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-sm">{c.cardType ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700 font-medium text-sm">{c.organization?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400 tracking-wide">
                          {c.organization?.number ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {c.iqamaNumber && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenewalId(c.id) }}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700
                                         bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            >
                              تجديد
                            </button>
                          )}
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── Detail modal ─────────────────────────────────────────────────────── */}
      {detailId !== null && modalView === 'detail' && (
        <InlineModal
          title={isUnderProcedure ? 'تفاصيل عميل (تحت الإجراء)' : 'تفاصيل عميل'}
          onClose={closeDetail}
        >
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : detailClient ? (
            <>
              {isUnderProcedure ? (
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
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 mb-5">
                    {[
                      { label: 'اسم العميل', val: detailClient.name },
                      { label: 'رقم الهاتف', val: detailClient.phone },
                      { label: 'المؤسسة', val: detailClient.organization?.name },
                      { label: 'رقم الإقامة', val: detailClient.iqamaNumber },
                      { label: 'تاريخ انتهاء الإقامة', val: formatBothDates(detailClient.iqamaEndDate) },
                      { label: 'كرت العمل', val: detailClient.cardType },
                      { label: 'تاريخ الدفعة القادمة', val: isMonthly ? nextMonthlyDue : detailClient.nextPaymentDate?.slice(0, 10) },
                      { label: 'طريقة الدفع', val: detailClient.paymentType },
                      { label: isMonthly ? 'القسط الشهري' : 'المبلغ الإجمالي', val: detailClient.amount != null ? detailClient.amount.toLocaleString('en-US') : null },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-gray-900">{val ?? '—'}</p>
                      </div>
                    ))}
                  </div>

                  {isMonthly ? (
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">تاريخ الدفعة القادمة</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {nextMonthlyDue ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">يوم الاستلام في الشهر</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {detailClient.boardNumber || '—'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">المبلغ المدفوع</p>
                        <p className="text-base font-bold text-emerald-600">{paidAmount.toLocaleString('en-US')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
                        <p className="text-base font-bold text-sky-700">{remaining.toLocaleString('en-US')}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => setModalView('payments')}
                      className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-6 py-2.5 transition-colors">
                      {isMonthly ? 'الدفعيات' : 'عرض الدفعيات'}
                    </button>
                    <button onClick={() => setShowCards(true)}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-2.5 transition-colors">
                      كرت العمل
                    </button>
                  </div>
                </>
              )}

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

      {/* ─── Card issuances modal ─────────────────────────────────────────────── */}
      {showCards && detailClient && (
        <ClientCardIssuancesModal
          clientId={detailClient.id}
          organizationId={detailClient.organization?.id ?? null}
          organizationName={detailClient.organization?.name ?? null}
          onClose={() => setShowCards(false)}
        />
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
                      <td className="px-4 py-3 font-medium text-gray-900">{s.step?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{s.step?.number ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{s.stepDate ? s.stepDate.slice(0, 10) : '—'}</td>
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
                          {p.amount != null ? p.amount.toLocaleString('en-US') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.createdAt ? p.createdAt.slice(0, 10) : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.notes ?? ''}</td>
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

      {/* ─── Renewal modal ────────────────────────────────────────────────────── */}
      {renewalId !== null && (() => {
        const renewalClient = clients.find((c) => c.id === renewalId)
        return (
          <InlineModal
            title={`تجديد إقامة — ${renewalClient?.name ?? '—'} (${renewalClient?.paymentType ?? '—'})`}
            onClose={closeRenewal}
          >
            <form onSubmit={handleRenewIqama}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="sm:col-span-3">
                  <label className={labelCls}>تاريخ انتهاء الإقامة</label>
                  <HijriDateInput
                    value={renewEndDate}
                    onChange={setRenewEndDate}
                    defaultMode="hijri"
                    hasError={renewSubmitAttempted && !renewEndDate}
                  />
                  {renewSubmitAttempted && !renewEndDate && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
                </div>
                <div>
                  <label className={labelCls}>المبلغ</label>
                  <input type="number" min={0} value={renewAmount} onChange={(e) => setRenewAmount(e.target.value)}
                    className={`${fldCls} ${renewSubmitAttempted && !renewAmount ? 'border-red-400 focus:ring-red-400' : ''}`} />
                  {renewSubmitAttempted && !renewAmount && <p className="text-xs text-red-500 mt-1">مطلوب</p>}
                </div>
                {renewalClient?.paymentType === 'شهري' ? (
                  <div>
                    <label className={labelCls}>يوم الاستلام من كل شهر</label>
                    <input type="number" min={1} max={31} value={renewDayOfMonth}
                      onChange={(e) => setRenewDayOfMonth(e.target.value)} className={fldCls} />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>المبلغ المستلم</label>
                    <input type="number" min={0} value={renewReceivedAmount}
                      onChange={(e) => setRenewReceivedAmount(e.target.value)} className={fldCls} />
                  </div>
                )}
              </div>

              {renewalClient?.paymentType !== 'شهري' && (
                <div className="mb-5">
                  <label className={labelCls}>ملاحظات عن الدفعية</label>
                  <input type="text" value={renewNotes} onChange={(e) => setRenewNotes(e.target.value)} className={fldCls} />
                </div>
              )}

              {renewIqama.isError && (
                <p className="text-sm text-red-600 mb-4">
                  {renewIqama.error instanceof Error ? renewIqama.error.message : 'حدث خطأ غير متوقع'}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={closeRenewal}
                  className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                             text-gray-700 text-sm font-medium px-5 py-2.5 transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={renewIqama.isPending}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                             text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  {renewIqama.isPending ? '...' : 'حفظ'}
                </button>
              </div>
            </form>
          </InlineModal>
        )
      })()}

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
