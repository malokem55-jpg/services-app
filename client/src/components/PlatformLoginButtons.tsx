import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { openLoginWithExtension } from '../lib/loginExtension'
import Modal from './Modal'
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

/**
 * أزرار الدخول لمنصّات مقيم / الغرفة التجارية لمؤسسة معيّنة.
 * مكوّن مشترك بين جدول المؤسسات وجدول العملاء — يغلّف كامل تدفّق الدخول
 * (نافذة التأكيد + التنبيه + التواصل مع إضافة المتصفح) بحيث لا يتكرّر المنطق.
 *
 * تُعرض كل المنصّات المفعّلة، وزر «غير مسجّل» معطّل لمن لا بيانات دخول لها —
 * بنفس سلوك جدول المؤسسات.
 */
export default function PlatformLoginButtons({
  organizationId,
  organizationName,
  fullWidth = false,
}: {
  organizationId: number | null | undefined
  organizationName: string | null | undefined
  fullWidth?: boolean
}) {
  const { data: platforms = [] } = useLoginPlatforms()
  const { data: credSummaries = [] } = useCredentialSummaries()
  const { data: chamberCities = [] } = useChamberCities()

  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  const [loginPendingKey, setLoginPendingKey] = useState<string | null>(null)
  const [confirmLogin, setConfirmLogin] = useState<LoginPlatform | null>(null)

  useEffect(() => {
    if (!loginNotice) return
    const t = setTimeout(() => setLoginNotice(null), 6000)
    return () => clearTimeout(t)
  }, [loginNotice])

  // كل المنصّات المفعّلة المعروضة (مقيم / الغرفة)
  const enabledPlatforms = platforms.filter(
    (p) => p.enabled && VISIBLE_PLATFORMS.includes(p.key),
  )

  function hasCreds(platformKey: string) {
    return credSummaries.some(
      (s) => s.organizationId === organizationId && s.platform === platformKey,
    )
  }

  async function handlePlatformLogin(platform: LoginPlatform) {
    if (organizationId == null) return
    setLoginPendingKey(platform.key)
    try {
      const cred = await apiFetch<{ username: string; password: string; city: ChamberCityKey | null }>(
        `/api/org-credentials/${organizationId}/${platform.key}`,
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

  if (organizationId == null || enabledPlatforms.length === 0) return null

  // تسمية مختصرة داخل عمود الجدول الضيّق (الجوال يعرض الاسم الكامل)
  const compactLabel = (k: LoginPlatform['key']) =>
    k === 'chamber' ? 'الغرفة' : PLATFORM_LABELS[k]

  const username = confirmLogin
    ? credSummaries.find(
        (s) => s.organizationId === organizationId && s.platform === confirmLogin.key,
      )?.username
    : undefined
  const pending = confirmLogin ? loginPendingKey === confirmLogin.key : false

  return (
    <>
      <div className={fullWidth ? 'space-y-2' : 'flex flex-col items-stretch gap-1'}>
        {enabledPlatforms.map((platform) =>
          hasCreds(platform.key) ? (
            <button
              key={platform.key}
              onClick={(e) => {
                e.stopPropagation()
                setConfirmLogin(platform)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5
                          text-xs font-semibold border border-sky-200 bg-sky-50 text-sky-700
                          hover:bg-sky-100 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {fullWidth ? `دخول ${PLATFORM_LABELS[platform.key]}` : `دخول ${compactLabel(platform.key)}`}
            </button>
          ) : (
            <button
              key={platform.key}
              disabled
              className="flex w-full items-center justify-center rounded-lg px-2.5 py-1.5
                          text-xs font-medium border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed whitespace-nowrap"
            >
              {fullWidth ? `${PLATFORM_LABELS[platform.key]} — غير مسجّل` : `${compactLabel(platform.key)} غير مسجّل`}
            </button>
          ),
        )}
      </div>

      {/* تنبيه عائم أسفل الشاشة */}
      {loginNotice && (
        <div role="status"
          className="fixed inset-x-0 bottom-4 z-60 mx-auto flex w-[92%] max-w-md items-center justify-between gap-3
                     rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 shadow-lg">
          <p className="text-sm text-amber-800">{loginNotice}</p>
          <button onClick={() => setLoginNotice(null)} aria-label="إغلاق التنبيه"
            className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* نافذة تأكيد تسجيل الدخول */}
      {confirmLogin && (
        <Modal title="تأكيد تسجيل الدخول" size="sm" onClose={() => { if (!pending) setConfirmLogin(null) }}>
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
                <span className="font-bold text-gray-900">{PLATFORM_LABELS[confirmLogin.key]}</span>
                {' '}وتعبئة بيانات الدخول تلقائيًا
              </p>
            </div>

            <dl className="rounded-xl border border-gray-200/80 bg-gray-50/70 divide-y divide-gray-100 shadow-xs">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-xs font-semibold text-gray-500">المنصة</dt>
                <dd className="text-sm font-bold text-sky-700">{PLATFORM_LABELS[confirmLogin.key]}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-xs font-semibold text-gray-500">المؤسسة</dt>
                <dd className="text-sm font-bold text-gray-900 truncate">{organizationName ?? '—'}</dd>
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
              <button type="button" onClick={() => handlePlatformLogin(confirmLogin)} disabled={pending}
                className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                           text-white text-sm font-semibold py-2.5 min-h-11 transition-colors
                           shadow-sm shadow-sky-500/20">
                {pending ? 'جارٍ الفتح...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
