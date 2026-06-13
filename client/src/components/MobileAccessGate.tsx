import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation } from 'react-router-dom'
import { BASE_URL } from '../lib/api'
import { isMobileDevice } from '../lib/customMode'

/**
 * بوابة الوصول من الهاتف: عند إيقاف إعداد «تشغيل المشروع على الهاتف» يُمنع فتح
 * الموقع على متصفحات الجوال وتطبيق PWA — قبل شاشة الدخول أصلاً — ويبقى يعمل
 * على الكمبيوتر فقط. تقرأ الإعداد من نقطة عامة بلا مصادقة.
 * صفحة التحكم /mobile-access تبقى متاحة دائمًا حتى يمكن إعادة التفعيل من الهاتف.
 */
export default function MobileAccessGate() {
  const mobile = isMobileDevice()
  const { pathname } = useLocation()

  // الكمبيوتر يعمل دائمًا بلا أي انتظار، وصفحة التحكم مستثناة على كل الأجهزة
  const enabled = mobile && pathname !== '/mobile-access'

  const { data, isLoading } = useQuery<{ runOnMobile: boolean }>({
    queryKey: ['mobile-access'],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/ui-settings/mobile-access`)
      if (!res.ok) throw new Error('failed')
      return res.json() as Promise<{ runOnMobile: boolean }>
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  if (!enabled) return <Outlet />

  // على الهاتف ننتظر الإعداد قبل العرض حتى لا يومض الموقع ثم يُحجب
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (data?.runOnMobile === false) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50/80 flex items-center justify-center px-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">هذا الموقع يعمل على الكمبيوتر فقط</h1>
        </div>
      </div>
    )
  }

  return <Outlet />
}
