import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { organizationSchema, getErrors } from '../lib/schemas'
import { iqamaStatus, cardTypeValue, formatYears } from '../lib/clientForm'
import { openLoginWithExtension } from '../lib/loginExtension'
import {
  useLoginPlatforms,
  useCredentialSummaries,
  useChamberCities,
  PLATFORM_LABELS,
  VISIBLE_PLATFORMS,
  CHAMBER_CITY_LABELS,
  type LoginPlatform,
  type ChamberCityKey,
} from '../hooks/useLoginPlatforms'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import OrgCardIssuancesModal from '../components/OrgCardIssuancesModal'
import CopyButton from '../components/CopyButton'

interface OrgItem {
  id: number
  name: string | null
  number: string | null
  expiredDate: string | null
  cardsWithdrawn: number
  cardsRemaining: number
  _count: { clients: number }
}

interface OrgFormData {
  name: string
  number: string
  expiredDate: string
}

interface OrgClientItem {
  id: number
  name: string | null
  phone: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  cardType: string | null
  organization: { id: number; name: string | null } | null
}

const EMPTY_FORM: OrgFormData = { name: '', number: '', expiredDate: '' }

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', {
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

/* ─── Clients of org modal ─────────────────────────────────────────────────── */
function OrgClientsModal({
  orgId, orgName, onClose,
}: { orgId: number; orgName: string; onClose: () => void }) {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: clients = [], isLoading } = useQuery<OrgClientItem[]>({
    queryKey: ['clients', { organizationId: orgId }],
    queryFn: () => apiFetch<OrgClientItem[]>(`/api/clients?organizationId=${orgId}`),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white w-full sm:max-w-5xl
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
            <h2 className="text-base font-semibold text-gray-900">عملاء المؤسسة</h2>
            <p className="text-xs text-sky-600 font-medium mt-0.5">{orgName}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700
                               px-2.5 py-0.5 text-xs font-semibold">
                {clients.length} عميل
              </span>
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium text-sm">لا يوجد عملاء في هذه المؤسسة</p>
            </div>
          ) : (
            <>
              {/* ── Desktop table ── */}
              <div className="hidden sm:block rounded-xl overflow-hidden border border-gray-200">
                <div className="overflow-auto max-h-[75vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-sky-600 text-white text-right">
                        <th className="px-3 py-3 text-xs font-semibold">اسم العميل</th>
                        <th className="px-3 py-3 text-xs font-semibold">رقم الهاتف</th>
                        <th className="px-3 py-3 text-xs font-semibold">رقم الإقامة</th>
                        <th className="px-3 py-3 text-xs font-semibold">تاريخ إنتهاء الإقامة</th>
                        <th className="px-3 py-3 text-xs font-semibold">كرت العمل</th>
                        <th className="px-3 py-3 text-xs font-semibold text-center">قيمة كرت العمل</th>
                        <th className="px-3 py-3 text-xs font-semibold">المؤسسة</th>
                        <th className="px-3 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => {
                        const iqama = iqamaStatus(c.iqamaEndDate)
                        const cardVal = cardTypeValue(c.cardType)
                        const endDateCls = iqama.cls.includes('red')
                          ? 'text-red-600 font-semibold'
                          : iqama.cls.includes('amber')
                          ? 'text-amber-600 font-semibold'
                          : 'text-gray-600'

                        return (
                          <tr
                            key={c.id}
                            className="border-t border-gray-100 hover:bg-sky-50/40 cursor-pointer transition-colors"
                            onClick={() => { navigate(`/clients/${c.id}`); onClose() }}
                          >
                            <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">
                              {c.name ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                              {c.phone ?? '—'}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-gray-500 tracking-wide whitespace-nowrap">
                              {c.iqamaNumber ? c.iqamaNumber : (
                                <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700
                                                 px-2 py-0.5 text-xs font-semibold">
                                  تحت الإجراء
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-xs whitespace-nowrap ${endDateCls}`}>
                              {c.iqamaEndDate ? c.iqamaEndDate.slice(0, 10) : '—'}
                            </td>
                            <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                              {c.cardType ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold
                                ${cardVal > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                {formatYears(cardVal)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                              {c.organization?.name ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <svg className="w-3.5 h-3.5 text-gray-300 inline-block" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Mobile cards ── */}
              <div className="sm:hidden space-y-3">
                {clients.map((c) => {
                  const iqama = iqamaStatus(c.iqamaEndDate)
                  const cardVal = cardTypeValue(c.cardType)
                  const badgeCls = c.iqamaEndDate
                    ? (iqama.cls.includes('red')
                      ? 'bg-red-100 text-red-700'
                      : iqama.cls.includes('amber')
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700')
                    : 'bg-sky-100 text-sky-700'

                  return (
                    <div
                      key={c.id}
                      onClick={() => { navigate(`/clients/${c.id}`); onClose() }}
                      className="bg-gray-50 rounded-xl border border-gray-200 p-3.5
                                 active:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-semibold text-gray-900 text-sm">{c.name ?? '—'}</p>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                          {c.iqamaNumber ? (iqama.extra ?? 'ساري') : 'تحت الإجراء'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                        {c.phone && <span className="font-mono">{c.phone}</span>}
                        {c.iqamaNumber && <span className="font-mono">{c.iqamaNumber}</span>}
                        {c.iqamaEndDate && (
                          <span className={iqama.cls.includes('red') ? 'text-red-600' : iqama.cls.includes('amber') ? 'text-amber-600' : ''}>
                            {c.iqamaEndDate.slice(0, 10)}
                          </span>
                        )}
                        {c.cardType && c.cardType !== 'بدون' && (
                          <span>كرت: {c.cardType}</span>
                        )}
                        <span className={cardVal > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                          قيمة: {formatYears(cardVal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OrganizationsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; org: OrgItem | null }>({
    open: false, org: null,
  })
  const [form, setForm] = useState<OrgFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [clientsModal, setClientsModal] = useState<{ orgId: number; orgName: string } | null>(null)
  const [cardsModal, setCardsModal] = useState<{ orgId: number; orgName: string } | null>(null)
  const [showNewYear, setShowNewYear] = useState(false)

  const { data: orgs = [], isLoading, isError } = useQuery<OrgItem[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgItem[]>('/api/organizations'),
  })

  // منصات الدخول الخارجية المفعّلة (مقيم / الغرفة) — تعطيل المنصة يخفي عمودها
  const { data: platforms = [] } = useLoginPlatforms()
  const { data: credSummaries = [] } = useCredentialSummaries()
  const { data: chamberCities = [] } = useChamberCities()
  const enabledPlatforms = platforms.filter((p) => p.enabled && VISIBLE_PLATFORMS.includes(p.key))
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  const [loginPendingKey, setLoginPendingKey] = useState<string | null>(null)
  const [confirmLogin, setConfirmLogin] = useState<{ org: OrgItem; platform: LoginPlatform } | null>(null)

  useEffect(() => {
    if (!loginNotice) return
    const t = setTimeout(() => setLoginNotice(null), 6000)
    return () => clearTimeout(t)
  }, [loginNotice])

  function hasCreds(orgId: number, platformKey: string) {
    return credSummaries.some((s) => s.organizationId === orgId && s.platform === platformKey)
  }

  async function handlePlatformLogin(org: OrgItem, platform: LoginPlatform) {
    const pendingKey = `${org.id}-${platform.key}`
    setLoginPendingKey(pendingKey)
    try {
      const cred = await apiFetch<{ username: string; password: string; city: ChamberCityKey | null }>(
        `/api/org-credentials/${org.id}/${platform.key}`,
      )
      // الغرفة: الرابط يُحدَّد حسب مدينة المؤسسة، لا من رابط ثابت للمنصة
      let loginUrl = platform.loginUrl
      if (platform.key === 'chamber') {
        if (!cred.city) {
          setLoginNotice('لم تُحدَّد مدينة الغرفة لهذه المؤسسة — عدّلها من الملف الشخصي')
          return
        }
        loginUrl = chamberCities.find((c) => c.key === cred.city)?.loginUrl ?? ''
        if (!loginUrl) {
          setLoginNotice(`رابط دخول غرفة ${CHAMBER_CITY_LABELS[cred.city]} غير مضبوط — اضبطه من الملف الشخصي`)
          return
        }
      } else if (!loginUrl) {
        setLoginNotice(`رابط صفحة دخول ${PLATFORM_LABELS[platform.key]} غير مضبوط — اضبطه من الملف الشخصي`)
        return
      }
      const filled = await openLoginWithExtension({
        url: loginUrl,
        username: cred.username,
        password: cred.password,
      })
      if (!filled) {
        setLoginNotice('إضافة المتصفح غير مثبتة — فُتحت صفحة الدخول بدون تعبئة تلقائية')
      }
    } catch (e) {
      setLoginNotice(e instanceof Error ? e.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoginPendingKey(null)
      setConfirmLogin(null)
    }
  }

  function renderLoginButton(org: OrgItem, platform: LoginPlatform, fullWidth = false) {
    const saved = hasCreds(org.id, platform.key)
    if (!saved) {
      return (
        <button
          disabled
          className={`${fullWidth ? 'w-full flex' : 'inline-flex'} items-center justify-center rounded-lg px-3 py-1.5
                      text-xs font-medium border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed`}
        >
          غير مسجّل
        </button>
      )
    }
    return (
      <button
        onClick={() => setConfirmLogin({ org, platform })}
        className={`${fullWidth ? 'w-full flex' : 'inline-flex'} items-center justify-center gap-1.5 rounded-lg px-3 py-1.5
                    text-xs font-semibold border border-sky-200 bg-sky-50 text-sky-700
                    hover:bg-sky-100 transition-colors`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        {fullWidth ? `دخول ${PLATFORM_LABELS[platform.key]}` : 'دخول'}
      </button>
    )
  }

  const grantCards = useMutation({
    mutationFn: () =>
      apiFetch<{ lastGrantAt: string }>('/api/card-issuances/grant', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-issuances'] })
      qc.invalidateQueries({ queryKey: ['organizations'] })
      setShowNewYear(false)
    },
  })

  const filteredOrgs = useMemo(() => {
    const q = search.trim()
    if (!q) return orgs
    return orgs.filter((o) => o.name?.includes(q) || o.number?.includes(q))
  }, [orgs, search])

  // نسخ اسم المؤسسة إلى الحافظة مع تأكيد بصري قصير — يمنع فتح نافذة العملاء عند الضغط
  async function copyName(e: React.MouseEvent, org: OrgItem) {
    e.stopPropagation()
    if (!org.name) return
    try {
      await navigator.clipboard.writeText(org.name)
      setCopiedId(org.id)
      setTimeout(() => setCopiedId((c) => (c === org.id ? null : c)), 1500)
    } catch {
      /* الحافظة غير متاحة — نتجاهل بصمت */
    }
  }

  function openAdd() { setForm(EMPTY_FORM); setModal({ open: true, org: null }) }
  function openEdit(org: OrgItem) { setForm(orgToForm(org)); setModal({ open: true, org }) }
  function closeModal() { setModal({ open: false, org: null }); setForm(EMPTY_FORM); setFormErrors({}) }
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
    const errs = getErrors(organizationSchema, {
      name: form.name,
      number: form.number,
      expiredDate: form.expiredDate,
    })
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return
    const payload = buildPayload(form)
    if (modal.org) updateOrg.mutate({ id: modal.org.id, body: payload })
    else createOrg.mutate(payload)
  }

  const isPending = createOrg.isPending || updateOrg.isPending
  const mutationError = createOrg.error ?? updateOrg.error

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-gray-50/80">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-4 page-enter
                       md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">المؤسسات</h2>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredOrgs.length} مؤسسة{search.trim() ? ' (بحث)' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowNewYear(true)}
              className="flex items-center gap-1.5 bg-white border border-amber-300 hover:bg-amber-50
                         text-amber-700 text-sm font-semibold rounded-xl px-4 py-2.5 min-h-11
                         shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              بدء سنة هجرية جديدة
            </button>
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
        </div>

        {/* Search */}
        <div className="relative mb-4 md:shrink-0">
          <svg className="pointer-events-none absolute inset-y-0 inset-e-3 my-auto w-4 h-4 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المؤسسة أو رقم السجل..."
            className="w-full rounded-xl border border-gray-200 bg-white pe-10 ps-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-11" />
        </div>

        {isError && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            تعذّر تحميل المؤسسات، حاول تحديث الصفحة.
          </div>
        )}

        {loginNotice && (
          <div role="status"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">{loginNotice}</p>
            <button onClick={() => setLoginNotice(null)} aria-label="إغلاق التنبيه"
              className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
                {/* ↓ الضغط على هذا القسم يفتح قائمة العملاء */}
                <div
                  className="px-4 pt-4 pb-3 cursor-pointer active:bg-gray-50 transition-colors"
                  onClick={() => setClientsModal({ orgId: org.id, orgName: org.name ?? '—' })}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm inline-flex items-center gap-1">
                      {org.name ?? '—'}
                      {org.name && (
                        <button onClick={(e) => copyName(e, org)}
                          aria-label="نسخ اسم المؤسسة"
                          className="shrink-0 text-gray-300 hover:text-sky-600 active:text-sky-700 transition-colors p-0.5">
                          {copiedId === org.id ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </button>
                      )}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-sky-100
                                     text-sky-700 px-2 py-0.5 text-xs font-semibold shrink-0">
                      {org._count.clients} فرد
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    {org.number && <span className="font-mono">{org.number}</span>}
                    {org.expiredDate && <span>{formatDate(org.expiredDate)}</span>}
                    <span className="text-amber-600 font-medium">
                      مسحوبة: {formatYears(org.cardsWithdrawn)}
                    </span>
                    <span className={org.cardsRemaining <= 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                      متبقية: {formatYears(org.cardsRemaining)}
                    </span>
                  </div>
                </div>
                {enabledPlatforms.length > 0 && (
                  <div className="px-4 pb-3 space-y-2">
                    {enabledPlatforms.map((p) => (
                      <div key={p.key}>{renderLoginButton(org, p, true)}</div>
                    ))}
                  </div>
                )}
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
                      <button onClick={() => setCardsModal({ orgId: org.id, orgName: org.name ?? '—' })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium
                                   text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M3 10h18M7 15h2m4 0h4M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        الكروت
                      </button>
                      <div className="w-px bg-gray-100" />
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
        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">اسم المؤسسة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center w-20">الأفراد</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">الكروت المسحوبة</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center">الكروت المتبقية</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">رقم السجل</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-sky-700">انتهاء السجل</th>
                  {enabledPlatforms.map((p) => (
                    <th key={p.key} className="px-4 py-2.5 text-xs font-semibold text-sky-700 text-center whitespace-nowrap">
                      دخول {PLATFORM_LABELS[p.key]}
                    </th>
                  ))}
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-2.5">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${55 + j * 10}%` }} />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))
                  : filteredOrgs.length === 0
                  ? (
                    <tr>
                      <td colSpan={7 + enabledPlatforms.length} className="px-4 py-16 text-center">
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
                    /* ↓ الضغط على الصف كله يفتح قائمة العملاء */
                    <tr
                      key={org.id}
                      className="border-b border-gray-100 hover:bg-sky-50/60 cursor-pointer transition-colors"
                      onClick={() => setClientsModal({ orgId: org.id, orgName: org.name ?? '—' })}
                    >
                      <td className="px-4 py-2.5 font-semibold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{org.name ?? '—'}</span>
                          {org.name && (
                            <button onClick={(e) => copyName(e, org)}
                              aria-label="نسخ اسم المؤسسة"
                              title={copiedId === org.id ? 'تم النسخ' : 'نسخ اسم المؤسسة'}
                              className="rounded-md p-1 text-gray-300 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                              {copiedId === org.id ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full
                                         bg-sky-100 text-xs font-semibold text-sky-700 px-2">
                          {org._count.clients}
                        </span>
                      </td>
                      {/* خليتا الكروت محايدتان: النقر لا يفتح نافذة العملاء — سجل الكروت من أيقونته فقط */}
                      <td className="px-4 py-2.5 text-center cursor-default" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center justify-center h-7 rounded-full
                                         bg-amber-100 text-xs font-semibold text-amber-700 px-2.5">
                          {formatYears(org.cardsWithdrawn)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center cursor-default" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-flex items-center justify-center h-7 rounded-full px-2.5 text-xs font-semibold
                          ${org.cardsRemaining <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {formatYears(org.cardsRemaining)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 tracking-wide">
                        <div className="flex items-center gap-1.5">
                          <span>{org.number ?? '—'}</span>
                          {org.number && <CopyButton value={org.number} label="رقم السجل" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-sm whitespace-nowrap">
                        {formatDate(org.expiredDate)}
                      </td>
                      {enabledPlatforms.map((p) => (
                        <td key={p.key} className="px-4 py-2.5 text-center cursor-default whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}>
                          {renderLoginButton(org, p)}
                        </td>
                      ))}
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
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
                            <button onClick={(e) => { e.stopPropagation(); setCardsModal({ orgId: org.id, orgName: org.name ?? '—' }) }}
                              aria-label="سجل الكروت"
                              className="rounded-lg p-1.5 text-gray-400 hover:text-emerald-600
                                         hover:bg-emerald-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M3 10h18M7 15h2m4 0h4M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openEdit(org) }} aria-label="تعديل"
                              className="rounded-lg p-1.5 text-gray-400 hover:text-sky-600
                                         hover:bg-sky-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(org.id) }} aria-label="حذف"
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

      {/* Org Clients Modal */}
      {clientsModal && (
        <OrgClientsModal
          orgId={clientsModal.orgId}
          orgName={clientsModal.orgName}
          onClose={() => setClientsModal(null)}
        />
      )}

      {/* Org Card Issuances Modal */}
      {cardsModal && (
        <OrgCardIssuancesModal
          orgId={cardsModal.orgId}
          orgName={cardsModal.orgName}
          onClose={() => setCardsModal(null)}
        />
      )}

      {/* Platform Login Confirm Modal */}
      {confirmLogin && (() => {
        const { org, platform } = confirmLogin
        const pending = loginPendingKey === `${org.id}-${platform.key}`
        const username = credSummaries.find(
          (s) => s.organizationId === org.id && s.platform === platform.key,
        )?.username
        return (
          <Modal title="تأكيد تسجيل الدخول" size="sm" onClose={() => { if (!pending) setConfirmLogin(null) }}>
            <div className="space-y-4">
              {/* أيقونة + وصف */}
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center
                                shadow-sm shadow-sky-500/30">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  سيتم فتح صفحة دخول منصة{' '}
                  <span className="font-bold text-gray-900">{PLATFORM_LABELS[platform.key]}</span>
                  {' '}وتعبئة بيانات الدخول تلقائيًا
                </p>
              </div>

              {/* تفاصيل العملية */}
              <dl className="rounded-xl border border-gray-200/80 bg-gray-50/70 divide-y divide-gray-100 shadow-xs">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-semibold text-gray-500">المنصة</dt>
                  <dd className="text-sm font-bold text-sky-700">{PLATFORM_LABELS[platform.key]}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-semibold text-gray-500">المؤسسة</dt>
                  <dd className="text-sm font-bold text-gray-900 truncate">{org.name ?? '—'}</dd>
                </div>
                {username && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <dt className="text-xs font-semibold text-gray-500">اسم المستخدم</dt>
                    <dd className="text-sm font-semibold text-gray-700 font-mono tracking-wide truncate" dir="ltr">
                      {username}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmLogin(null)} disabled={pending}
                  className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60
                             text-gray-700 text-sm font-medium py-2.5 min-h-11 transition-colors">
                  إلغاء
                </button>
                <button type="button" onClick={() => handlePlatformLogin(org, platform)} disabled={pending}
                  className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                             text-white text-sm font-semibold py-2.5 min-h-11 transition-colors
                             shadow-sm shadow-sky-500/20">
                  {pending ? 'جارٍ الفتح...' : 'تأكيد'}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Grant New Cards Confirm Modal */}
      {showNewYear && (
        <Modal title="بدء سنة هجرية جديدة" onClose={() => setShowNewYear(false)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 leading-relaxed">
                سنة هجرية جديدة وستُمنح كل المؤسسات رصيد <span className="font-bold">4 كروت</span> جديدة فورًا.
                وسيُحذف <span className="font-bold">سجل إصدارات الكروت بالكامل</span> ويعود كرت العمل لكل
                العملاء إلى <span className="font-bold">«بدون»</span>. لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>

            {grantCards.isError && (
              <p className="text-sm text-red-600">
                {grantCards.error instanceof Error ? grantCards.error.message : 'حدث خطأ غير متوقع'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowNewYear(false)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                           text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors">
                إلغاء
              </button>
              <button type="button" onClick={() => grantCards.mutate()} disabled={grantCards.isPending}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60
                           text-white text-sm font-semibold py-3 min-h-11 transition-colors">
                {grantCards.isPending ? 'جارٍ المنح...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
                placeholder="اسم المؤسسة" autoFocus
                className={`${inputCls}${formErrors.name ? ' border-red-400! focus:ring-red-400!' : ''}`} />
              {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>رقم السجل</label>
              <input type="text" value={form.number} onChange={(e) => setField('number', e.target.value)}
                placeholder="رقم السجل التجاري"
                className={`${inputCls}${formErrors.number ? ' border-red-400! focus:ring-red-400!' : ''}`} />
              {formErrors.number && <p className="mt-1 text-xs text-red-500">{formErrors.number}</p>}
            </div>
            <div>
              <label className={labelCls}>تاريخ انتهاء السجل</label>
              <input type="date" value={form.expiredDate} onChange={(e) => setField('expiredDate', e.target.value)}
                className={`${inputCls}${formErrors.expiredDate ? ' border-red-400! focus:ring-red-400!' : ''}`} />
              {formErrors.expiredDate && <p className="mt-1 text-xs text-red-500">{formErrors.expiredDate}</p>}
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
