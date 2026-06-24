import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import {
  type ClientFormData,
  type OrgOption,
  type ArrivalPlaceOption,
  buildClientPayload,
  iqamaStatus,
  tafweedAlertErrors,
  tafweedDisplayValue,
} from '../lib/clientForm'
import { formatBothDates } from '../lib/hijri'
import { clientSchema, clientStepSchema, clientPaymentSchema, getErrors } from '../lib/schemas'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import ClientEditFormFields from '../components/ClientEditFormFields'
import ClientCardIssuancesModal from '../components/ClientCardIssuancesModal'
import HijriDateInput from '../components/HijriDateInput'
import MonthlyPaymentsPanel from '../components/MonthlyPaymentsPanel'
import CopyButton from '../components/CopyButton'

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

interface ClientPaymentMonthly {
  id: number
  receivedDate: string | null
  status: string | null
  amount: number | null
  carriedOverAmount: number | null
}

interface ServiceStep {
  id: number
  name: string | null
  order: number | null
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
  notes: string | null
  paymentType: string | null
  nextPaymentDate: string | null
  amount: number | null
  monthlyReceiptDay: number | null
  generateMonthlyAfterIqama: boolean | null
  tafweedAlertDate: string | null
  tafweedDone: boolean | null
  serviceId: number | null
  organizationId: number | null
  lastStepId: number | null
  arrivalPlaceId: number | null
  service: { id: number; name: string | null } | null
  organization: { id: number; name: string | null } | null
  arrivalPlace: { id: number; name: string } | null
  steps: ClientStep[]
  payments: ClientPayment[]
  paymentMonthlies: ClientPaymentMonthly[]
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
    monthlyReceiptDay: c.monthlyReceiptDay != null ? String(c.monthlyReceiptDay) : '',
    arrivalPlaceId: c.arrivalPlaceId != null ? String(c.arrivalPlaceId) : '',
    generateMonthlyAfterIqama: c.generateMonthlyAfterIqama ? '1' : '',
    // البوكس مفعَّل للتنبيه النشط فقط — المنجز ("تم التفويض") يظهر غير مفعَّل
    // وتحفظ علامته في tafweedDone حتى لا تمسحها تعديلات الحقول الأخرى
    tafweedAlertEnabled: c.tafweedAlertDate && !c.tafweedDone ? '1' : '',
    tafweedAlertDate: c.tafweedAlertDate ? c.tafweedAlertDate.slice(0, 10) : '',
    tafweedDone: c.tafweedDone ? '1' : '',
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function IqamaBadge({ dateStr }: { dateStr: string | null }) {
  const s = iqamaStatus(dateStr)
  if (!dateStr) return <span className="text-sm font-semibold text-gray-900">—</span>
  const badgeCls = s.cls.includes('red')
    ? 'bg-red-100 text-red-700 border border-red-200'
    : s.cls.includes('amber')
    ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-gray-900">{formatBothDates(dateStr)}</span>
      {s.extra && (
        <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls}`}>
          {s.extra}
        </span>
      )}
    </div>
  )
}

function InfoField({ label, value, custom }: { label: string; value?: string | null; custom?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {custom ?? (
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900">{value ?? '—'}</p>
          {value && <CopyButton value={value} label={label} />}
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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

  // الصفحة المصدر تمررها الصفحات في state عند فتح التفاصيل — تُستخدم للرجوع ولتمييز الشريط
  const location = useLocation()
  const sourcePage = (location.state as { from?: string } | null)?.from

  // الرجوع للصفحة التي فُتحت منها التفاصيل، وعند الفتح المباشر (لا تاريخ تنقّل) نعود لصفحة العملاء
  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate(sourcePage ?? '/clients')
  }

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: client, isLoading, isError } = useQuery<ClientDetail>({
    queryKey: ['client', clientId],
    queryFn: () => apiFetch<ClientDetail>(`/api/clients/${clientId}`),
    enabled: !isNaN(clientId),
  })

  const { data: serviceSteps = [] } = useQuery<ServiceStep[]>({
    queryKey: ['service-steps', client?.serviceId ?? 0],
    queryFn: () => apiFetch<ServiceStep[]>(`/api/service-steps?serviceId=${client!.serviceId}`),
    enabled: !!client?.serviceId,
  })

  const { data: organizations = [] } = useQuery<OrgOption[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgOption[]>('/api/organizations'),
    staleTime: 5 * 60 * 1000,
  })

  // جهة القدوم خاصية عميل تحت الإجراء فقط — لا تُجلب القائمة لعميل مكتمل
  const { data: arrivalPlaces = [] } = useQuery<ArrivalPlaceOption[]>({
    queryKey: ['arrival-places'],
    queryFn: () => apiFetch<ArrivalPlaceOption[]>('/api/arrival-places'),
    enabled: !!client && !client.iqamaNumber,
    staleTime: 5 * 60 * 1000,
  })

  // ── state ────────────────────────────────────────────────────────────────

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<ClientFormData>({
    name: '', phone: '', passport: '', iqamaNumber: '',
    iqamaEndDate: '', cardType: 'بدون', paymentType: '', amount: '',
    serviceId: '', organizationId: '', boardNumber: '', visaNumber: '',
    receivedAmount: '', notes: '', nextPaymentDate: '', monthlyReceiptDay: '', arrivalPlaceId: '',
    generateMonthlyAfterIqama: '', tafweedAlertEnabled: '', tafweedAlertDate: '', tafweedDone: '',
  })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [showDeleteClient, setShowDeleteClient] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showCards, setShowCards] = useState(false)
  const [stepId, setStepId] = useState('')
  const [stepDate, setStepDate] = useState('')
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [deleteStepId, setDeleteStepId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payErrors, setPayErrors] = useState<Record<string, string>>({})
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null)

  // إصدار الإقامة
  const [showIssueIqama, setShowIssueIqama] = useState(false)
  const [issueNumber, setIssueNumber] = useState('')
  const [issueEndDate, setIssueEndDate] = useState('')
  const [issueAttempted, setIssueAttempted] = useState(false)

  // ── mutations ────────────────────────────────────────────────────────────

  const updateClient = useMutation({
    mutationFn: (body: ReturnType<typeof buildClientPayload>) =>
      apiFetch<ClientDetail>(`/api/clients/${clientId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      // التحويل إلى شهري يحذف الدفعات ويولّد جدول دفعيات جديداً على السيرفر
      qc.invalidateQueries({ queryKey: ['client-payment-monthlies', clientId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setShowEdit(false)
    },
  })

  const deleteClient = useMutation({
    mutationFn: () => apiFetch<unknown>(`/api/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['deleted-client-dues'] })
      navigate('/clients')
    },
  })

  const addStep = useMutation({
    mutationFn: (body: { clientId: number; stepId: number; stepDate?: string }) =>
      apiFetch<unknown>('/api/client-steps', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setStepId(''); setStepDate('')
    },
  })

  const deleteStep = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`/api/client-steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', clientId] }); setDeleteStepId(null) },
  })

  const addPayment = useMutation({
    mutationFn: (body: { clientId: number; amount?: number; isDone: boolean; notes?: string }) =>
      apiFetch<unknown>('/api/client-payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPayAmount(''); setPayNotes('')
    },
  })

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`/api/client-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeletePaymentId(null)
    },
  })

  const issueIqama = useMutation({
    mutationFn: (body: { iqamaNumber: string; iqamaEndDate: string }) =>
      apiFetch<unknown>(`/api/clients/${clientId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setShowIssueIqama(false)
      setIssueNumber(''); setIssueEndDate(''); setIssueAttempted(false)
    },
  })

  // ── handlers ─────────────────────────────────────────────────────────────

  function openEdit() {
    if (!client) return
    setEditForm(clientToForm(client))
    setEditErrors({})
    setShowEdit(true)
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const errs = getErrors(clientSchema(false), editForm)
    // التحويل من شهري إلى سنوي: المبلغ المستلم وتاريخ الدفعة القادمة إلزاميان
    if (client?.paymentType === 'شهري' && editForm.paymentType === 'سنوي') {
      if (!editForm.receivedAmount) {
        errs.receivedAmount = 'المبلغ المستلم مطلوب'
      } else if (Number(editForm.receivedAmount) > Number(editForm.amount)) {
        errs.receivedAmount = 'المبلغ المستلم لا يتجاوز المبلغ الإجمالي'
      }
      if (!editForm.nextPaymentDate) {
        errs.nextPaymentDate = 'تاريخ الدفعة القادمة مطلوب'
      }
    }
    // تنبيه التفويض: التفعيل يستلزم تاريخًا غير سابق لليوم. التاريخ النشط المحفوظ
    // يُقبل كما هو، أما إعادة تفعيل تنبيه منجز فتُعامل كإدخال جديد
    Object.assign(
      errs,
      tafweedAlertErrors(editForm, client?.tafweedDone ? null : client?.tafweedAlertDate),
    )
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
    const errs = getErrors(clientPaymentSchema, { amount: payAmount })
    setPayErrors(errs)
    if (Object.keys(errs).length > 0) return
    addPayment.mutate({ clientId, amount: payAmount ? Number(payAmount) : undefined, isDone: true, notes: payNotes || undefined })
  }

  function handleIssueIqama(e: React.FormEvent) {
    e.preventDefault()
    setIssueAttempted(true)
    if (!issueNumber || !issueEndDate) return
    issueIqama.mutate({ iqamaNumber: issueNumber, iqamaEndDate: issueEndDate })
  }

  // ── loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6 space-y-4 page-enter">
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
          <button onClick={goBack}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
            العودة
          </button>
        </div>
      </div>
    )
  }

  // ── derived values ────────────────────────────────────────────────────────

  const isUnderProcedure = !client.iqamaNumber
  const isMonthly = client.paymentType === 'شهري'
  // للعميل الشهري: الدفعة القادمة هي أقرب دفعية مستحقة من جدول الأقساط
  const nextMonthlyDue = (client.paymentMonthlies ?? [])
    .filter((m) => m.status !== 'paid' && m.receivedDate)
    .map((m) => (m.receivedDate as string).slice(0, 10))
    .sort()[0] ?? null
  const paidAmount = client.payments
    .filter((p) => p.isDone)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const remaining = (client.amount ?? 0) - paidAmount
  const currentStep = client.steps[0]?.step?.name ?? '—'
  // الدين المستحق لحظة الحذف — نفس حساب الخادم: المتأخر + المرحّل للشهري، والمتبقي للسنوي
  const todayStr = new Date().toISOString().slice(0, 10)
  const outstandingDebt = isMonthly
    ? (client.paymentMonthlies ?? []).reduce((sum, m) => {
        if (m.status === 'paid' || !m.receivedDate) return sum
        return m.receivedDate.slice(0, 10) <= todayStr
          ? sum + (m.amount ?? 0)
          : sum + (m.carriedOverAmount ?? 0)
      }, 0)
    : Math.max(remaining, 0)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5 page-enter">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={goBack}
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
            <button onClick={openEdit}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                         hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 min-h-10
                         transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              تعديل
            </button>

            {showDeleteClient ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-700 font-medium whitespace-nowrap">تأكيد حذف العميل؟</span>
                  <DeleteConfirm
                    onConfirm={() => deleteClient.mutate()}
                    onCancel={() => setShowDeleteClient(false)}
                    isPending={deleteClient.isPending}
                  />
                </div>
                {outstandingDebt > 0 && (
                  <p className="text-xs text-red-600 max-w-60">
                    تنبيه: عليه مستحقات غير مسدّدة بمبلغ{' '}
                    <span className="font-bold">{outstandingDebt.toLocaleString('en-US')} ر.س</span>
                    {' '}— ستُحفظ تلقائياً في صفحة ديون المحذوفين
                  </p>
                )}
              </div>
            ) : (
              <button onClick={() => setShowDeleteClient(true)}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white
                           hover:bg-red-50 text-red-600 text-sm font-medium px-4 py-2.5 min-h-10
                           transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف
              </button>
            )}
          </div>
        </div>

        {/* ── Info card — نفس تصميم modal التفاصيل ── */}
        <SectionCard title={isUnderProcedure ? 'تفاصيل عميل (تحت الإجراء)' : 'تفاصيل عميل'}>

          {isUnderProcedure ? (
            /* ─ تحت الإجراء ─ */
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 mb-5">
                <InfoField label="اسم العميل"       value={client.name} />
                <InfoField label="رقم الهاتف"        value={client.phone} />
                <InfoField label="المؤسسة"           value={client.organization?.name} />
                <InfoField label="رقم الجواز"        value={client.passport} />
                <InfoField label="رقم الحدود"        value={client.boardNumber} />
                <InfoField label="رقم التأشيرة"      value={client.visaNumber} />
                <InfoField label="جهة القدوم"        value={client.arrivalPlace?.name} />
                <InfoField label="الخطوة الحالية"    value={currentStep} />
                <InfoField label="كرت العمل"         value={client.cardType} />
                <InfoField label="تاريخ تنبيه التفويض والتصديق"
                  value={tafweedDisplayValue(client.tafweedAlertDate, client.tafweedDone)} />
                <InfoField label="تاريخ الدفعة القادمة"
                  value={isMonthly ? nextMonthlyDue : client.nextPaymentDate?.slice(0, 10)} />
                <InfoField label="طريقة الدفع"       value={client.paymentType} />
                <InfoField label="المبلغ الإجمالي"
                  value={client.amount != null ? client.amount.toLocaleString('en-US') : null} />
                <InfoField label="المبلغ المدفوع"
                  value={paidAmount.toLocaleString('en-US')} />
              </div>

              {/* المتبقي */}
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-bold text-sky-700">{remaining.toLocaleString('en-US')}</p>
                  <CopyButton value={remaining.toLocaleString('en-US')} label="المتبقي" />
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setShowSteps(true)}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  الخطوات
                </button>
                <button
                  onClick={() => setShowPayments(true)}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  الدفعيات
                </button>
                <button
                  onClick={() => setShowIssueIqama(true)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  إصدار الإقامة
                </button>
              </div>
            </>
          ) : (
            /* ─ مكتمل (لديه إقامة) ─ */
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 mb-5">
                <InfoField label="اسم العميل"  value={client.name} />
                <InfoField label="رقم الهاتف"  value={client.phone} />
                <InfoField label="المؤسسة"     value={client.organization?.name} />
                <InfoField label="رقم الإقامة" value={client.iqamaNumber} />
                <InfoField label="تاريخ انتهاء الإقامة"
                  custom={<IqamaBadge dateStr={client.iqamaEndDate} />} />
                <InfoField label="كرت العمل"   value={client.cardType} />
                {/* العميل السنوي: حقول الدفع تبقى ضمن الشبكة. الشهري له صف رباعي مستقل أدناه */}
                {!isMonthly && (
                  <>
                    <InfoField label="تاريخ الدفعة القادمة"
                      value={client.nextPaymentDate?.slice(0, 10)} />
                    <InfoField label="طريقة الدفع" value={client.paymentType} />
                    <InfoField label="المبلغ الإجمالي"
                      value={client.amount != null ? client.amount.toLocaleString('en-US') : null} />
                  </>
                )}
              </div>

              {isMonthly ? (
                <>
                  {/* الصف قبل الأخير: أربعة حقول للدفع الشهري */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <InfoField label="طريقة الدفع" value={client.paymentType} />
                    <InfoField label="القسط الشهري"
                      value={client.amount != null ? client.amount.toLocaleString('en-US') : null} />
                    <InfoField label="يوم الاستلام في الشهر"
                      value={client.monthlyReceiptDay != null ? String(client.monthlyReceiptDay) : null} />
                    <InfoField label="تاريخ الدفعة القادمة" value={nextMonthlyDue} />
                  </div>

                  {/* الصف الأخير: هل تستمر الدفعيات الشهرية بعد انتهاء الإقامة؟ */}
                  <div className={`rounded-xl px-4 py-3 mb-5 border ${
                    client.generateMonthlyAfterIqama
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <p className={`text-sm font-semibold ${
                      client.generateMonthlyAfterIqama ? 'text-emerald-700' : 'text-gray-600'
                    }`}>
                      {client.generateMonthlyAfterIqama
                        ? '✅ تستمر الدفعيات الشهرية لهذا العميل حتى بعد انتهاء إقامته'
                        : '⛔ تتوقف الدفعيات الشهرية عند انتهاء إقامته'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 mb-5">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">المبلغ المدفوع</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-emerald-600">{paidAmount.toLocaleString('en-US')}</p>
                      <CopyButton value={paidAmount.toLocaleString('en-US')} label="المبلغ المدفوع" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">المتبقي</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-sky-700">{remaining.toLocaleString('en-US')}</p>
                      <CopyButton value={remaining.toLocaleString('en-US')} label="المتبقي" />
                    </div>
                  </div>
                </div>
              )}

              {/* زر الدفعيات — الخطوات تخص مرحلة تحت الإجراء فقط */}
              <div className="flex flex-wrap gap-2.5 mt-1">
                <button
                  onClick={() => setShowPayments(true)}
                  className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  {isMonthly ? 'الدفعيات' : 'عرض الدفعيات'}
                </button>
                <button
                  onClick={() => setShowCards(true)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  كرت العمل
                </button>
              </div>
            </>
          )}

        </SectionCard>


      </main>

      {/* ── نافذة كرت العمل ── */}
      {showCards && (
        <ClientCardIssuancesModal
          clientId={client.id}
          organizationId={client.organization?.id ?? null}
          organizationName={client.organization?.name ?? null}
          onClose={() => setShowCards(false)}
        />
      )}

      {/* ── نافذة خطوات الخدمة ── */}
      {showSteps && (
        <Modal title="خطوات الخدمة" size="lg" onClose={() => setShowSteps(false)}>
          {client.serviceId ? (
            <form onSubmit={handleAddStep} className="mb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>الخطوة</label>
                  <select value={stepId} onChange={(e) => setStepId(e.target.value)}
                    className={`${inputCls}${stepErrors.stepId ? ' border-red-400! focus:ring-red-400!' : ''}`}>
                    <option value="">اختر الخطوة...</option>
                    {serviceSteps.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.order != null ? `${st.order}. ` : ''}{st.name}
                      </option>
                    ))}
                  </select>
                  {stepErrors.stepId && <p className="mt-1 text-xs text-red-500">{stepErrors.stepId}</p>}
                </div>
                <div>
                  <label className={labelCls}>التاريخ</label>
                  <input type="date" value={stepDate} onChange={(e) => setStepDate(e.target.value)}
                    className={`${inputCls}${stepErrors.stepDate ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                  {stepErrors.stepDate && <p className="mt-1 text-xs text-red-500">{stepErrors.stepDate}</p>}
                </div>
              </div>
              <button type="submit" disabled={addStep.isPending}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold px-8 py-2.5 transition-colors">
                {addStep.isPending ? '...' : 'إضافة'}
              </button>
              {addStep.isError && (
                <p className="text-xs text-red-600 mt-2">
                  {addStep.error instanceof Error ? addStep.error.message : 'حدث خطأ'}
                </p>
              )}
            </form>
          ) : (
            <p className="text-xs text-gray-400 mb-4">لا توجد خدمة مرتبطة بهذا العميل لإضافة خطوات</p>
          )}
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-600 text-white text-right">
                  <th className="px-4 py-3 text-xs font-semibold">الخطوة</th>
                  <th className="px-4 py-3 text-xs font-semibold">رقم الخطوة</th>
                  <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
                  <th className="px-4 py-3 w-14" />
                </tr>
              </thead>
              <tbody>
                {client.steps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                      لا توجد خطوات مسجلة
                    </td>
                  </tr>
                ) : (
                  client.steps.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{s.step?.name ?? '—'}</span>
                          {s.step?.name && <CopyButton value={s.step.name} label="الخطوة" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{s.step?.order ?? '—'}</span>
                          {s.step?.order != null && <CopyButton value={String(s.step.order)} label="رقم الخطوة" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{s.stepDate ? s.stepDate.slice(0, 10) : '—'}</span>
                          {s.stepDate && <CopyButton value={s.stepDate.slice(0, 10)} label="التاريخ" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ── نافذة الدفعات ── */}
      {showPayments && (
        <Modal title={isMonthly ? 'الدفعيات الشهرية' : 'الدفعات'} size={isMonthly ? 'xl' : 'lg'}
          onClose={() => setShowPayments(false)}>
          {isMonthly && (
            <MonthlyPaymentsPanel clientId={clientId} monthlyAmount={client.amount} />
          )}
          {!isMonthly && remaining > 0 && (
            <form onSubmit={handleAddPayment}
              className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-3">
                تسجيل دفعة (المتبقي: {remaining.toLocaleString('en-US')} ر.س)
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>المبلغ المستلم (ر.س)</label>
                  <input type="number" min={1} max={remaining} value={payAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setPayAmount(val > remaining ? String(remaining) : e.target.value)
                    }}
                    className={`${inputCls}${payErrors.amount ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                  {payErrors.amount && <p className="mt-1 text-xs text-red-500">{payErrors.amount}</p>}
                </div>
                <div>
                  <label className={labelCls}>ملاحظات</label>
                  <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="ملاحظات اختيارية" className={inputCls} />
                </div>
              </div>
              <button type="submit"
                disabled={addPayment.isPending || !payAmount || Number(payAmount) <= 0}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold px-8 py-2.5 transition-colors">
                {addPayment.isPending ? '...' : 'حفظ'}
              </button>
              {addPayment.isError && (
                <p className="text-xs text-red-600 mt-2">
                  {addPayment.error instanceof Error ? addPayment.error.message : 'حدث خطأ'}
                </p>
              )}
            </form>
          )}
          {!isMonthly && remaining <= 0 && client.payments.length > 0 && (
            <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3
                            text-sm text-emerald-700 text-center font-medium">
              تم استلام المبلغ الإجمالي كاملاً
            </div>
          )}
          {!isMonthly && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-600 text-white text-right">
                  <th className="px-4 py-3 text-xs font-semibold">المبلغ</th>
                  <th className="px-4 py-3 text-xs font-semibold">التاريخ</th>
                  <th className="px-4 py-3 text-xs font-semibold">ملاحظات</th>
                  <th className="px-4 py-3 w-14" />
                </tr>
              </thead>
              <tbody>
                {client.payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                      لا توجد دفعات مسجلة
                    </td>
                  </tr>
                ) : (
                  client.payments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{p.amount != null ? `${p.amount.toLocaleString('en-US')} ر.س` : '—'}</span>
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </Modal>
      )}

      {/* ── إصدار الإقامة modal ── */}
      {showIssueIqama && (
        <Modal title="إصدار رقم إقامة للعميل" onClose={() => { setShowIssueIqama(false); setIssueAttempted(false) }}>
          <form onSubmit={handleIssueIqama} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>رقم الإقامة</label>
                <input type="text" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)}
                  className={`${inputCls}${issueAttempted && !issueNumber ? ' border-red-400! focus:ring-red-400!' : ''}`} />
                {issueAttempted && !issueNumber && (
                  <p className="text-xs text-red-500 mt-1">رقم الإقامة مطلوب</p>
                )}
              </div>
              <div>
                <label className={labelCls}>تاريخ انتهاء الإقامة</label>
                <HijriDateInput
                  value={issueEndDate}
                  onChange={setIssueEndDate}
                  defaultMode="hijri"
                  hasError={issueAttempted && !issueEndDate}
                />
                {issueAttempted && !issueEndDate && (
                  <p className="text-xs text-red-500 mt-1">التاريخ مطلوب</p>
                )}
              </div>
            </div>

            {issueIqama.isError && (
              <p className="text-sm text-red-600">
                {issueIqama.error instanceof Error ? issueIqama.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => { setShowIssueIqama(false); setIssueAttempted(false) }}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={issueIqama.isPending}
                className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-11 transition-colors">
                {issueIqama.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── تعديل بيانات العميل modal ── */}
      {showEdit && (
        <Modal title="تعديل بيانات العميل" size="lg" onClose={() => { setShowEdit(false); setEditErrors({}) }}>
          <form onSubmit={handleEdit} className="space-y-4">
            <ClientEditFormFields
              form={editForm}
              onChange={(field, value) => setEditForm((prev) => {
                if (field === 'paymentType') {
                  // الرجوع لطريقة الدفع الأصلية يستعيد القيم الأصلية (تراجع عن التحويل)
                  if (value === (client.paymentType ?? '')) {
                    return {
                      ...prev,
                      paymentType: value,
                      amount: client.amount != null ? String(client.amount) : '',
                      boardNumber: client.boardNumber ?? '',
                      monthlyReceiptDay: client.monthlyReceiptDay != null ? String(client.monthlyReceiptDay) : '',
                      nextPaymentDate: client.nextPaymentDate ?? '',
                      receivedAmount: '',
                    }
                  }
                  // التحويل إلى شهري يتطلب إدخال قسط شهري جديد بدل المبلغ السنوي القديم
                  if (value === 'شهري') {
                    return { ...prev, paymentType: value, amount: '' }
                  }
                  // التحويل إلى سنوي يتطلب إدخال المبلغ الإجمالي والمستلم وتاريخ الدفعة القادمة
                  if (value === 'سنوي') {
                    return { ...prev, paymentType: value, amount: '', receivedAmount: '', nextPaymentDate: '' }
                  }
                }
                return { ...prev, [field]: value }
              })}
              organizations={organizations}
              errors={editErrors}
              underProcedure={isUnderProcedure}
              convertingToMonthly={client.paymentType !== 'شهري' && editForm.paymentType === 'شهري'}
              convertingToYearly={client.paymentType === 'شهري' && editForm.paymentType === 'سنوي'}
              paidAmount={paidAmount}
              arrivalPlaces={arrivalPlaces}
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
