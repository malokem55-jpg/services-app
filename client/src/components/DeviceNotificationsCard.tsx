import { useEffect, useState } from 'react'
import { subscribeToPush } from '../hooks/usePushNotifications'

type State = 'idle' | 'working' | 'done' | 'denied' | 'unsupported' | 'error'

// آيفون لا يعرض أزرار الإشعارات ويحتاج تثبيت التطبيق على الشاشة الرئيسية + ضغطة مستخدم
// لطلب الإذن. هذا الكرت يمنح المستخدم مسارًا يدويًا لتفعيل/تحديث اشتراك هذا الجهاز
// ويُظهر النتيجة بوضوح بدل ابتلاع الأخطاء بصمت.
export default function DeviceNotificationsCard() {
  const [state, setState] = useState<State>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [permission, setPermission] = useState<NotificationPermission | 'unavailable'>('unavailable')

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '')

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
  }, [])

  async function handleEnable() {
    setState('working')
    setErrMsg('')
    const res = await subscribeToPush(true)
    if ('Notification' in window) setPermission(Notification.permission)
    if (res.ok) {
      setState('done')
    } else if (res.reason === 'denied') {
      setState('denied')
    } else if (res.reason === 'unsupported') {
      setState('unsupported')
    } else {
      setState('error')
      setErrMsg(res.message ?? '')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-700">إشعارات هذا الجهاز</h3>
        {permission === 'granted' && (
          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
            مسموح ✓
          </span>
        )}
        {permission === 'denied' && (
          <span className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
            محظور
          </span>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        <p className="text-[13px] text-gray-600 leading-relaxed">
          اضغط الزر لتفعيل الإشعارات على هذا الجهاز، أو لتحديث الاشتراك إن توقّفت الإشعارات
          عن الوصول (يستبدل الاشتراك القديم بآخر جديد).
        </p>

        <button
          type="button"
          onClick={handleEnable}
          disabled={state === 'working'}
          className="w-full rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                     text-white text-[13px] font-semibold py-2 min-h-10 transition-colors
                     shadow-sm shadow-sky-500/20"
        >
          {state === 'working' ? 'جارٍ التفعيل...' : 'تفعيل / تحديث الإشعارات على هذا الجهاز'}
        </button>

        {state === 'done' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd" />
            </svg>
            <p className="text-xs text-emerald-700 font-medium">
              تم تفعيل الإشعارات على هذا الجهاز بنجاح.
            </p>
          </div>
        )}

        {state === 'denied' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs text-red-700 leading-relaxed">
              إذن الإشعارات محظور على هذا الجهاز.
              {isIOS
                ? ' من إعدادات الآيفون: الإشعارات ← «كيان» ← فعّل «السماح بالإشعارات»، ثم أعد المحاولة.'
                : ' فعّل الإذن من إعدادات المتصفح/الجهاز ثم أعد المحاولة.'}
            </p>
          </div>
        )}

        {state === 'unsupported' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800 leading-relaxed">
              هذا الجهاز/المتصفح لا يدعم إشعارات الويب.
              {isIOS
                ? ' على الآيفون افتح التطبيق من الأيقونة المثبّتة على الشاشة الرئيسية (لا من سفاري).'
                : ''}
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs text-red-700 leading-relaxed">
              تعذّر تفعيل الإشعارات{errMsg ? `: ${errMsg}` : ''}. أعد المحاولة.
            </p>
          </div>
        )}

        {isIOS && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            ملاحظة للآيفون: يجب فتح التطبيق من الأيقونة المثبّتة على الشاشة الرئيسية حتى تعمل
            الإشعارات.
          </p>
        )}
      </div>
    </div>
  )
}
