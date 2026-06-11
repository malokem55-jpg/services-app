import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Modal from './Modal'
import {
  useLoginPlatforms,
  useCredentialSummaries,
  PLATFORM_LABELS,
  VISIBLE_PLATFORMS,
  type PlatformKey,
  type LoginPlatform,
} from '../hooks/useLoginPlatforms'

interface OrgLite {
  id: number
  name: string | null
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors ' +
  'min-h-11 md:min-h-0 md:py-2 md:rounded-lg'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

/* ─── نافذة بيانات دخول مؤسسة على منصة ─────────────────────────────────────── */
function CredentialModal({
  orgId, orgName, platform, hasCredentials, onClose,
}: {
  orgId: number
  orgName: string
  platform: PlatformKey
  hasCredentials: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // تعبئة الحقول بالبيانات المحفوظة عند التعديل
  const { data: existing, isLoading } = useQuery<{ username: string; password: string }>({
    queryKey: ['org-credentials', orgId, platform],
    queryFn: () => apiFetch(`/api/org-credentials/${orgId}/${platform}`),
    enabled: hasCredentials,
    staleTime: 0,
    gcTime: 0, // لا نُبقي كلمة المرور في كاش الذاكرة بعد إغلاق النافذة
  })

  useEffect(() => {
    if (existing) {
      setUsername(existing.username)
      setPassword(existing.password)
    }
  }, [existing])

  const save = useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiFetch(`/api/org-credentials/${orgId}/${platform}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-credentials'] })
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/org-credentials/${orgId}/${platform}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-credentials'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('اسم المستخدم وكلمة المرور مطلوبان')
      return
    }
    save.mutate({ username: username.trim(), password })
  }

  const mutationError = save.error ?? remove.error

  return (
    <Modal title={`${orgName} — منصة ${PLATFORM_LABELS[platform]}`} onClose={onClose}>
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم على المنصة"
              autoFocus
              dir="ltr"
              className={`${inputCls} placeholder-shown:text-right`}
            />
          </div>
          <div>
            <label className={labelCls}>كلمة المرور</label>
            {/* الحاوية LTR حتى يقع زر العين والحشوة في نفس الجهة (يمين) فلا يغطي النص */}
            <div className="relative" dir="ltr">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور على المنصة"
                className={`${inputCls} pe-10 placeholder-shown:text-right`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute inset-y-0 inset-e-2 my-auto h-8 w-8 flex items-center justify-center
                           text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {(error || mutationError) && (
            <p className="text-sm text-red-600">
              {error || (mutationError instanceof Error ? mutationError.message : 'حدث خطأ غير متوقع')}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            {hasCredentials && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="rounded-xl border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60
                           text-red-600 text-sm font-medium px-4 py-3 min-h-11 transition-colors"
              >
                {remove.isPending ? '...' : 'حذف'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                         text-gray-700 text-sm font-medium py-3 min-h-11 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-sm font-semibold py-3 min-h-11 transition-colors"
            >
              {save.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/* ─── إعدادات منصة واحدة (تفعيل + رابط صفحة الدخول) ────────────────────────── */
function PlatformSettingsCard({ platform }: { platform: LoginPlatform }) {
  const qc = useQueryClient()
  const [loginUrl, setLoginUrl] = useState(platform.loginUrl)
  const [editingUrl, setEditingUrl] = useState(false)

  useEffect(() => setLoginUrl(platform.loginUrl), [platform.loginUrl])

  const update = useMutation({
    mutationFn: (patch: { enabled?: boolean; loginUrl?: string }) =>
      apiFetch<LoginPlatform>(`/api/login-platforms/${platform.key}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['login-platforms'] }),
  })

  function startEditUrl() {
    setLoginUrl(platform.loginUrl)
    setEditingUrl(true)
  }

  function cancelEditUrl() {
    setEditingUrl(false)
    setLoginUrl(platform.loginUrl)
  }

  function saveUrl() {
    update.mutate({ loginUrl: loginUrl.trim() }, { onSuccess: () => setEditingUrl(false) })
  }

  return (
    <div className="border-b border-gray-50 last:border-0 px-5 py-4 space-y-3.5">
      {/* سطر التفعيل: اسم المنصة + شارة الحالة، والمفتاح في الطرف المقابل */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-1.5 h-9 rounded-full shrink-0 transition-colors
                            ${platform.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-800">
                منصة {PLATFORM_LABELS[platform.key]}
              </p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold
                                ${platform.enabled
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-100 text-gray-500'}`}>
                {platform.enabled ? 'مفعّلة' : 'معطّلة'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              عند التعطيل يختفي عمود الدخول من جدول المؤسسات
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          dir="ltr"
          aria-checked={platform.enabled}
          aria-label={`تفعيل منصة ${PLATFORM_LABELS[platform.key]}`}
          disabled={update.isPending}
          onClick={() => update.mutate({ enabled: !platform.enabled })}
          className={`relative shrink-0 h-6.5 w-11.5 rounded-full transition-colors disabled:opacity-50
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2
                      ${platform.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5.5 w-5.5 rounded-full bg-white shadow-sm
                        transition-transform ${platform.enabled ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>

      <div>
        <label className={labelCls}>رابط صفحة تسجيل الدخول</label>
        {editingUrl ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://..."
              title="رابط صفحة تسجيل الدخول"
              dir="ltr"
              autoFocus
              className={inputCls}
            />
            <button
              type="button"
              onClick={saveUrl}
              disabled={update.isPending}
              className="shrink-0 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-sm font-semibold px-4 min-h-11 transition-colors"
            >
              {update.isPending ? '...' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={cancelEditUrl}
              disabled={update.isPending}
              aria-label="إلغاء تعديل الرابط"
              className="shrink-0 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                         disabled:opacity-60 text-gray-500 px-3 min-h-11 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative" dir="ltr">
            <div
              title={platform.loginUrl || 'لم يُضبط الرابط بعد'}
              className="rounded-xl border border-gray-200 bg-gray-100/70
                         ps-3 pe-10 py-2.5 text-sm text-gray-500 min-h-11
                         flex items-center select-all"
            >
              <span className="truncate">{platform.loginUrl || '—'}</span>
            </div>
            <button
              type="button"
              onClick={startEditUrl}
              aria-label="تعديل الرابط"
              title="تعديل الرابط"
              className="absolute inset-y-0 inset-e-1.5 my-auto h-8 w-8 flex items-center justify-center
                         rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-100/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        )}
        {update.isError && (
          <p className="mt-1 text-xs text-red-500">
            {update.error instanceof Error ? update.error.message : 'حدث خطأ'}
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── التبويب الكامل ───────────────────────────────────────────────────────── */
export default function PlatformCredentialsTab() {
  const { data: platforms = [], isLoading: platformsLoading } = useLoginPlatforms()
  const { data: summaries = [] } = useCredentialSummaries()
  const [search, setSearch] = useState('')
  const [credModal, setCredModal] = useState<{
    orgId: number
    orgName: string
    platform: PlatformKey
  } | null>(null)

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgLite[]>({
    queryKey: ['organizations'],
    queryFn: () => apiFetch<OrgLite[]>('/api/organizations'),
  })

  const visiblePlatforms = platforms.filter((p) => VISIBLE_PLATFORMS.includes(p.key))

  const query = search.trim().toLowerCase()
  const filteredOrgs = query
    ? orgs.filter((org) => (org.name ?? '').toLowerCase().includes(query))
    : orgs

  function hasCreds(orgId: number, platform: PlatformKey) {
    return summaries.some((s) => s.organizationId === orgId && s.platform === platform)
  }

  return (
    <div className="space-y-5 md:space-y-4">
      {/* إعدادات المنصات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">إعدادات المنصات</h3>
        </div>
        {platformsLoading ? (
          <div className="p-5 space-y-3">
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          visiblePlatforms.map((p) => <PlatformSettingsCard key={p.key} platform={p} />)
        )}
      </div>

      {/* بيانات دخول المؤسسات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50
                        flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-sky-700">بيانات دخول المؤسسات</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              سجّل اسم المستخدم وكلمة المرور لكل مؤسسة على كل منصة
            </p>
          </div>
          <div className="relative md:w-60 shrink-0">
            <svg
              className="w-4 h-4 text-gray-400 absolute inset-s-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مؤسسة..."
              aria-label="بحث في المؤسسات"
              className={`${inputCls} ps-9 bg-white`}
            />
          </div>
        </div>

        {orgsLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">لا توجد مؤسسات مضافة بعد</p>
        ) : filteredOrgs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            لا توجد مؤسسة مطابقة لـ «{search.trim()}»
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-100 bg-sky-50 text-right">
                  <th className="px-4 py-3 md:py-2.5 text-xs font-semibold text-sky-700">اسم المؤسسة</th>
                  {visiblePlatforms.map((p) => (
                    <th key={p.key} className="px-4 py-3 md:py-2.5 text-xs font-semibold text-sky-700 text-center">
                      بيانات {PLATFORM_LABELS[p.key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-gray-100 last:border-0 hover:bg-sky-50/40 transition-colors">
                    <td className="px-4 py-3 md:py-2 font-semibold text-gray-900">{org.name ?? '—'}</td>
                    {visiblePlatforms.map((p) => {
                      const saved = hasCreds(org.id, p.key)
                      return (
                        <td key={p.key} className="px-4 py-3 md:py-2 text-center">
                          <button
                            onClick={() =>
                              setCredModal({ orgId: org.id, orgName: org.name ?? '—', platform: p.key })
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                                        border transition-colors ${
                              saved
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-sky-600'
                            }`}
                          >
                            {saved && (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd" />
                              </svg>
                            )}
                            بيانات {PLATFORM_LABELS[p.key]}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تحميل إضافة المتصفح — مطلوبة للتعبئة التلقائية على كل جهاز */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">إضافة المتصفح — التعبئة التلقائية</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            تُثبَّت مرة واحدة على كل جهاز حتى تُملأ بيانات الدخول تلقائيًا في صفحة المنصة
          </p>
        </div>
        <div className="p-5 space-y-4">
          <a
            href="/extension.zip"
            download
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl
                       bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold
                       px-5 py-2.5 min-h-11 shadow-sm shadow-sky-500/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            تحميل ملف الإضافة (extension.zip)
          </a>

          <ol className="list-decimal ps-5 space-y-1.5 text-xs text-gray-500 leading-relaxed">
            <li>
              فك ضغط الملف في مجلد دائم لا يُحذف، مثل{' '}
              <span dir="ltr" className="font-mono text-gray-600">C:\muqeem-extension</span>
            </li>
            <li>
              افتح في Chrome الصفحة{' '}
              <span dir="ltr" className="font-mono text-gray-600">chrome://extensions</span>
              {' '}وفعّل <span className="font-semibold text-gray-600">Developer mode</span>
            </li>
            <li>
              اضغط <span className="font-semibold text-gray-600">Load unpacked</span> واختر المجلد الذي فككت فيه الضغط
            </li>
            <li>حدّث صفحة الموقع — انتهى، ولن تحتاج تكرارها على هذا الجهاز</li>
          </ol>
        </div>
      </div>

      {credModal && (
        <CredentialModal
          orgId={credModal.orgId}
          orgName={credModal.orgName}
          platform={credModal.platform}
          hasCredentials={hasCreds(credModal.orgId, credModal.platform)}
          onClose={() => setCredModal(null)}
        />
      )}
    </div>
  )
}
