import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import {
  useCredentialSummaries,
  CHAMBER_CITY_KEYS,
  CHAMBER_CITY_LABELS,
  type ChamberCityKey,
} from '../hooks/useLoginPlatforms'

// صفحة مخفية (لا تظهر في أي قائمة — الوصول بالرابط /credentials-import فقط):
// رفع ملف إكسل ببيانات دخول المؤسسات على منصتي مقيم والغرفة، معاينته وتعديله،
// ثم إدخاله في النظام. أعمدة الملف:
// اسم المؤسسة | يوزر مقيم | باسويرد مقيم | يوزر الغرفة | باسويرد الغرفة | مدينة الغرفة

/* ─── أنواع استجابة الخادم ─────────────────────────────────────────────────── */
interface PreviewRow {
  rowNumber: number
  orgNameRaw: string
  matchedOrgId: number | null
  matchedOrgName: string | null
  muqeem: { username: string; password: string } | null
  chamber: { username: string; password: string; city: ChamberCityKey | null; cityRaw: string } | null
}
interface ImportPreview {
  rows: PreviewRow[]
  totalRows: number
  matchedCount: number
}
interface CommitResult {
  muqeemCount: number
  chamberCount: number
  skipped: string[]
}
interface OrgLite {
  id: number
  name: string | null
}

/* ─── حالة الصف القابلة للتعديل ────────────────────────────────────────────── */
interface EditRow {
  key: string
  rowNumber: number
  orgNameRaw: string
  orgId: number | null
  muqeemUser: string
  muqeemPass: string
  chamberUser: string
  chamberPass: string
  city: ChamberCityKey | ''
  // موافقة صريحة على إدخال صف ناقص (بيانات منصة واحدة فقط، الأخرى غير متوفرة)
  includePartial: boolean
}

function toEditRow(r: PreviewRow): EditRow {
  return {
    key: `r${r.rowNumber}`,
    rowNumber: r.rowNumber,
    orgNameRaw: r.orgNameRaw,
    orgId: r.matchedOrgId,
    muqeemUser: r.muqeem?.username ?? '',
    muqeemPass: r.muqeem?.password ?? '',
    chamberUser: r.chamber?.username ?? '',
    chamberPass: r.chamber?.password ?? '',
    city: r.chamber?.city ?? '',
    includePartial: false,
  }
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const cellInput =
  'w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-colors'

// عدد اقتراحات الأسماء الأقرب التي تُعرض في أعلى قائمة الصف غير المطابق
const SUGGESTION_LIMIT = 6

// تطبيع عربي مطابق لتطبيع الخادم: إزالة التشكيل/التطويل وتوحيد الألف/الياء/التاء المربوطة
function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// مسافة ليفنشتاين (عدد التعديلات) لقياس قرب اسمين — صفّان مفردان لتوفير الذاكرة
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/* ─── الصفحة ───────────────────────────────────────────────────────────────── */
export default function CredentialsImportPage() {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<EditRow[]>([])

  const { data: orgs = [] } = useQuery<OrgLite[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgLite[]>('/api/organizations'),
  })
  const { data: summaries = [] } = useCredentialSummaries()

  const sortedOrgs = useMemo(
    () => [...orgs].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ar')),
    [orgs],
  )

  // مُرتِّب الأسماء الأقرب لاسم مستورد (تطابق تقريبي) — مع كاش بحسب الاسم المطبّع
  const suggestFor = useMemo(() => {
    const normedOrgs = orgs.map((o) => ({ org: o, n: normalizeAr(o.name ?? '') }))
    const cache = new Map<string, OrgLite[]>()
    return (raw: string): OrgLite[] => {
      const key = normalizeAr(raw)
      if (!key) return []
      const cached = cache.get(key)
      if (cached) return cached
      const ranked = normedOrgs
        .map(({ org, n }) => ({ org, d: levenshtein(key, n) }))
        .sort((a, b) => a.d - b.d || (a.org.name ?? '').localeCompare(b.org.name ?? '', 'ar'))
        .slice(0, SUGGESTION_LIMIT)
        .map((x) => x.org)
      cache.set(key, ranked)
      return ranked
    }
  }, [orgs])

  const parseMutation = useMutation({
    mutationFn: (f: File) =>
      apiFetch<ImportPreview>('/api/org-credentials-import/parse', {
        method: 'POST',
        headers: { 'Content-Type': XLSX_MIME },
        body: f,
      }),
    onSuccess: (data) => setRows(data.rows.map(toEditRow)),
  })

  const commitMutation = useMutation({
    mutationFn: (payload: unknown) =>
      apiFetch<CommitResult>('/api/org-credentials-import/commit', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-credentials'] }),
  })

  // ─── المسودة: حفظ الصفوف المتبقية على الخادم لإكمالها لاحقًا دون رفع الملف من جديد ───
  const draftQuery = useQuery<{ rows: EditRow[] }>({
    queryKey: ['credential-import-draft'],
    queryFn: () => apiFetch<{ rows: EditRow[] }>('/api/credential-import-draft'),
    staleTime: Infinity,
    gcTime: 0,
  })
  const saveDraft = useMutation({
    mutationFn: (rowsToSave: EditRow[]) =>
      apiFetch('/api/credential-import-draft', { method: 'PUT', body: JSON.stringify({ rows: rowsToSave }) }),
  })
  const clearDraft = useMutation({
    mutationFn: () => apiFetch('/api/credential-import-draft', { method: 'DELETE' }),
  })

  const [draftReady, setDraftReady] = useState(false) // اكتمل تحميل المسودة → يُسمح بالحفظ التلقائي
  const [restoredCount, setRestoredCount] = useState(0) // عدد صفوف استُرجعت من مسودة محفوظة

  // استرجاع المسودة مرة واحدة عند أول فتح للصفحة
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (draftQuery.isSuccess) {
      restoredRef.current = true
      const saved = draftQuery.data.rows ?? []
      if (saved.length > 0) {
        setRows(saved)
        setRestoredCount(saved.length)
      }
      setDraftReady(true)
    } else if (draftQuery.isError) {
      restoredRef.current = true
      setDraftReady(true)
    }
  }, [draftQuery.isSuccess, draftQuery.isError, draftQuery.data])

  // حفظ تلقائي مؤجّل: يُحفظ ما بقي، ويُحذف عند إفراغ الجدول
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!draftReady) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      if (rows.length > 0) saveDraft.mutate(rows)
      else clearDraft.mutate()
    }, 700)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, draftReady])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setRows([])
    setRestoredCount(0)
    parseMutation.reset()
    commitMutation.reset()
    if (selected) parseMutation.mutate(selected)
  }

  // حذف المسودة والبدء من جديد
  function handleDiscardDraft() {
    setRows([])
    setRestoredCount(0)
    setFile(null)
    parseMutation.reset()
    commitMutation.reset()
  }

  function patchRow(key: string, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    commitMutation.reset()
  }

  function hasSavedCreds(orgId: number | null, platform: 'muqeem' | 'chamber') {
    return orgId !== null && summaries.some((s) => s.organizationId === orgId && s.platform === platform)
  }

  // الصفوف الجاهزة للإدخال (مربوطة بمؤسسة):
  // - مكتمل (المنصتان): يُدخَل تلقائيًا.
  // - ناقص (منصة واحدة فقط): يُدخَل فقط إذا أكّد المستخدم بخانة الاختيار (includePartial).
  const commitRows = useMemo(
    () =>
      rows
        .filter((r) => r.orgId !== null)
        .map((r) => {
          const muqeem =
            r.muqeemUser.trim() && r.muqeemPass
              ? { username: r.muqeemUser.trim(), password: r.muqeemPass }
              : null
          const chamber =
            r.chamberUser.trim() && r.chamberPass && r.city
              ? { username: r.chamberUser.trim(), password: r.chamberPass, city: r.city }
              : null
          const completeCount = (muqeem ? 1 : 0) + (chamber ? 1 : 0)
          return { key: r.key, organizationId: r.orgId as number, muqeem, chamber, completeCount, includePartial: r.includePartial }
        })
        .filter((r) => r.completeCount === 2 || (r.completeCount === 1 && r.includePartial)),
    [rows],
  )

  // إدخال الصفوف الجاهزة، ثم إزالتها من الجدول لتبقى غير المطابقة/الناقصة حتى يعدّلها المستخدم
  function handleCommit() {
    if (commitRows.length === 0) return
    const committedKeys = new Set(commitRows.map((r) => r.key))
    // الخادم لا يحتاج حقل key الداخلي
    const payload = commitRows.map((r) => ({
      organizationId: r.organizationId,
      muqeem: r.muqeem,
      chamber: r.chamber,
    }))
    commitMutation.mutate(
      { rows: payload },
      { onSuccess: () => setRows((prev) => prev.filter((r) => !committedKeys.has(r.key))) },
    )
  }

  const muqeemTotal = commitRows.filter((r) => r.muqeem).length
  const chamberTotal = commitRows.filter((r) => r.chamber).length
  // الغرفة بلا مدينة: بيانات مكتملة لكن المدينة غير مختارة (لن تُدخل)
  const chamberMissingCity = rows.filter(
    (r) => r.orgId !== null && r.chamberUser.trim() && r.chamberPass && !r.city,
  ).length
  // صفوف غير مربوطة بمؤسسة (ستُتجاهل عند الإدخال ما لم تُربط يدويًا)
  const unmatchedCount = rows.filter((r) => r.orgId === null).length
  // صفوف ناقصة (منصة واحدة) مطابقة لم تُؤكَّد بعد بخانة الاختيار — لن تُدخل حتى تُفعَّل
  const pendingPartialCount = rows.filter((r) => {
    if (r.orgId === null) return false
    const m = !!(r.muqeemUser.trim() && r.muqeemPass)
    const c = !!(r.chamberUser.trim() && r.chamberPass && r.city)
    return m !== c && !r.includePartial
  }).length

  const result = commitMutation.data

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-5 space-y-5 page-enter">
        <div>
          <h2 className="text-xl font-bold text-gray-900">استيراد بيانات دخول المؤسسات</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            ارفع ملف إكسل (.xlsx) ببيانات دخول المؤسسات على مقيم والغرفة، راجِع البيانات وعدّلها، ثم أدخِلها
          </p>
        </div>

        {/* شعار استرجاع مسودة محفوظة */}
        {restoredCount > 0 && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 7" />
              </svg>
              <p className="text-sm text-sky-800">
                تم استرجاع مسودة محفوظة فيها <span className="font-bold">{restoredCount}</span> صف — أكمِلها من حيث توقفت.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="shrink-0 rounded-lg border border-sky-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200
                         text-sky-700 text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              حذف المسودة والبدء من جديد
            </button>
          </div>
        )}

        {/* اختيار الملف */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-sky-700">ملف البيانات (.xlsx)</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              الأعمدة المتوقعة: اسم الشركة، مقيم، الغرفة التجارية — وتكتب بيانات كل منصة بصيغة «اسم المستخدم - كلمة المرور».
              المدينة تكون الرياض افتراضيًا ويمكن تغييرها لكل صف بالأسفل.
            </p>
          </div>
          <div className="p-5 md:p-4 space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                         border-gray-300 hover:border-sky-400 hover:bg-sky-50/50 transition-colors
                         px-4 py-8 cursor-pointer text-center"
            >
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-medium text-gray-600">
                {file ? file.name : 'اضغط لاختيار ملف الإكسل'}
              </span>
              {file && <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} ك.ب</span>}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {parseMutation.isPending && <p className="text-sm text-gray-500">جارٍ قراءة الملف...</p>}

            {parseMutation.isError && (
              <p className="text-sm text-red-600">
                {parseMutation.error instanceof Error ? parseMutation.error.message : 'تعذّرت قراءة الملف'}
              </p>
            )}
          </div>
        </div>

        {/* المعاينة + التعديل */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50
                            flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-sky-700">مراجعة البيانات قبل الإدخال</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {rows.length} صف
                  {unmatchedCount > 0 && (
                    <span className="text-amber-600 font-semibold"> — منها {unmatchedCount} غير مطابقة</span>
                  )}
                  {' '}— يمكنك تعديل أي حقل، وربط المؤسسات غير المطابقة يدويًا
                </p>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {saveDraft.isPending ? 'جارٍ حفظ المسودة...' : 'يُحفظ تلقائيًا — يمكنك العودة لاحقًا وإكمال الباقي'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">
                  مقيم: {muqeemTotal}
                </span>
                <span className="rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1">
                  الغرفة: {chamberTotal}
                </span>
                {chamberMissingCity > 0 && (
                  <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1">
                    غرفة بلا مدينة: {chamberMissingCity}
                  </span>
                )}
                {pendingPartialCount > 0 && (
                  <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1">
                    ناقصة بانتظار تأكيد: {pendingPartialCount}
                  </span>
                )}
              </div>
            </div>

            {/* شريط الإدخال في الأعلى */}
            <div className="px-5 py-3.5 border-b border-gray-100 bg-white space-y-2.5">
              {commitMutation.isError && (
                <p className="text-sm text-red-600">
                  {commitMutation.error instanceof Error ? commitMutation.error.message : 'حدث خطأ أثناء الإدخال'}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  سيُدخَل <span className="font-bold text-gray-700">{commitRows.length}</span> مؤسسة جاهزة (
                  {muqeemTotal} مقيم، {chamberTotal} غرفة) وتُزال من الجدول، وتبقى الصفوف غير المطابقة أو الناقصة كما هي لتكملها.
                </p>
                <button
                  onClick={handleCommit}
                  disabled={commitRows.length === 0 || commitMutation.isPending}
                  className="shrink-0 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-sm font-semibold px-5 py-3 min-h-11 transition-colors shadow-sm shadow-sky-600/20"
                >
                  {commitMutation.isPending ? 'جارٍ الإدخال...' : 'إدخال الصفوف المتطابقة'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[920px]">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50 text-right text-sky-700">
                    <th className="px-3 py-2.5 font-semibold w-10">#</th>
                    <th className="px-3 py-2.5 font-semibold">المؤسسة في النظام</th>
                    <th className="px-3 py-2.5 font-semibold">يوزر مقيم</th>
                    <th className="px-3 py-2.5 font-semibold">باسويرد مقيم</th>
                    <th className="px-3 py-2.5 font-semibold">يوزر الغرفة</th>
                    <th className="px-3 py-2.5 font-semibold">باسويرد الغرفة</th>
                    <th className="px-3 py-2.5 font-semibold">مدينة الغرفة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const unmatched = r.orgId === null
                    const chamberFilled = r.chamberUser.trim() && r.chamberPass
                    const suggestions = unmatched ? suggestFor(r.orgNameRaw) : []
                    // اكتمال كل منصة + كشف الصف الناقص (منصة واحدة فقط) لعرض خانة الموافقة
                    const muqeemComplete = !!(r.muqeemUser.trim() && r.muqeemPass)
                    const chamberComplete = !!(r.chamberUser.trim() && r.chamberPass && r.city)
                    const completeCount = (muqeemComplete ? 1 : 0) + (chamberComplete ? 1 : 0)
                    const isPartial = !unmatched && completeCount === 1
                    const missingPlatform = muqeemComplete ? 'الغرفة' : 'مقيم'
                    return (
                      <tr
                        key={r.key}
                        className={`border-b border-gray-100 last:border-0 align-top ${
                          unmatched ? 'bg-amber-50/40' : 'hover:bg-sky-50/30'
                        } transition-colors`}
                      >
                        <td className="px-3 py-2 text-gray-400">{r.rowNumber}</td>

                        {/* اختيار المؤسسة */}
                        <td className="px-3 py-2 min-w-[200px]">
                          <div className="flex items-center gap-1">
                            <select
                              value={r.orgId ?? ''}
                              onChange={(e) =>
                                patchRow(r.key, { orgId: e.target.value ? Number(e.target.value) : null })
                              }
                              className={`${cellInput} ${unmatched ? 'border-amber-300 bg-amber-50/60' : ''}`}
                            >
                              <option value="">— تجاهل هذا الصف —</option>
                              {unmatched && suggestions.length > 0 && (
                                <optgroup label="الأقرب للاسم المستورد">
                                  {suggestions.map((o) => (
                                    <option key={`s-${o.id}`} value={o.id}>
                                      {o.name ?? `#${o.id}`}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="كل المؤسسات">
                                {sortedOrgs.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name ?? `#${o.id}`}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            {/* إلغاء الاختيار: يعيد الحقل فارغًا فيرجع الصف غير مطابق وتظهر الاقتراحات */}
                            {r.orgId !== null && (
                              <button
                                type="button"
                                onClick={() => patchRow(r.key, { orgId: null })}
                                aria-label="إلغاء اختيار المؤسسة وإفراغ الحقل"
                                title="إلغاء الاختيار (إفراغ الحقل)"
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200
                                           bg-white text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50
                                           transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span className="text-gray-400 truncate" title={r.orgNameRaw}>
                              من الملف: {r.orgNameRaw || '—'}
                            </span>
                            {unmatched ? (
                              <span className="text-amber-600 font-semibold">غير مطابقة</span>
                            ) : (
                              (hasSavedCreds(r.orgId, 'muqeem') || hasSavedCreds(r.orgId, 'chamber')) && (
                                <span className="text-indigo-500 font-semibold">سيُستبدل القديم</span>
                              )
                            )}
                          </div>
                          {/* صف ناقص (منصة واحدة): يُدخَل فقط بموافقة صريحة، والمنصة غير المتوفرة تبقى فارغة */}
                          {isPartial && (
                            <label className="mt-1.5 flex items-start gap-1.5 cursor-pointer select-none text-[10px] leading-snug">
                              <input
                                type="checkbox"
                                checked={r.includePartial}
                                onChange={(e) => patchRow(r.key, { includePartial: e.target.checked })}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-600 cursor-pointer"
                              />
                              <span className={r.includePartial ? 'text-sky-700 font-semibold' : 'text-gray-500'}>
                                إدخاله بدون «{missingPlatform}» (غير متوفر)
                              </span>
                            </label>
                          )}
                        </td>

                        {/* مقيم */}
                        <td className="px-3 py-2 min-w-[120px]">
                          <input
                            dir="ltr"
                            value={r.muqeemUser}
                            onChange={(e) => patchRow(r.key, { muqeemUser: e.target.value })}
                            className={cellInput}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[120px]">
                          <input
                            dir="ltr"
                            value={r.muqeemPass}
                            onChange={(e) => patchRow(r.key, { muqeemPass: e.target.value })}
                            className={cellInput}
                          />
                        </td>

                        {/* الغرفة */}
                        <td className="px-3 py-2 min-w-[120px]">
                          <input
                            dir="ltr"
                            value={r.chamberUser}
                            onChange={(e) => patchRow(r.key, { chamberUser: e.target.value })}
                            className={cellInput}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[120px]">
                          <input
                            dir="ltr"
                            value={r.chamberPass}
                            onChange={(e) => patchRow(r.key, { chamberPass: e.target.value })}
                            className={cellInput}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[110px]">
                          <select
                            value={r.city}
                            onChange={(e) => patchRow(r.key, { city: e.target.value as ChamberCityKey | '' })}
                            className={`${cellInput} ${
                              chamberFilled && !r.city ? 'border-amber-300 bg-amber-50/60' : ''
                            }`}
                          >
                            <option value="">— بلا —</option>
                            {CHAMBER_CITY_KEYS.map((c) => (
                              <option key={c} value={c}>
                                {CHAMBER_CITY_LABELS[c]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* النتيجة */}
        {result && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 md:py-3 border-b border-gray-100 bg-emerald-50/50">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-emerald-700">تم الإدخال بنجاح</h3>
            </div>
            <div className="p-5 md:p-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center min-w-28">
                  <div className="text-lg font-bold text-emerald-700">{result.muqeemCount}</div>
                  <div className="text-xs text-emerald-600">بيانات مقيم</div>
                </div>
                <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center min-w-28">
                  <div className="text-lg font-bold text-indigo-700">{result.chamberCount}</div>
                  <div className="text-xs text-indigo-600">بيانات الغرفة</div>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700">تم تجاهل ({result.skipped.length})</p>
                  <ul className="text-xs text-amber-700 leading-relaxed pr-4 list-disc space-y-0.5 max-h-48 overflow-y-auto">
                    {result.skipped.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
