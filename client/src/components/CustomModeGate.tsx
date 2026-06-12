import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useUiSettings } from '../hooks/useUiSettings'
import { isMobilePwa } from '../lib/customMode'

/**
 * بوابة النسخة المخصصة: داخل PWA مثبت على موبايل ومع تفعيل الإعداد تُقفل
 * كل المسارات على شاشات /m، وخارج هذه الحالة تُمنع شاشات /m وتعمل النسخة الكاملة.
 */
export default function CustomModeGate() {
  const mobilePwa = isMobilePwa()
  const { data: settings, isLoading } = useUiSettings()
  const { pathname } = useLocation()
  const inMobileArea = pathname === '/m' || pathname.startsWith('/m/')

  // على الموبايل المثبت ننتظر الإعدادات قبل العرض حتى لا تومض النسخة الخطأ
  if (mobilePwa && isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  const active = mobilePwa && settings?.showCustomMobileVersion === true

  if (active && !inMobileArea) return <Navigate to="/m" replace />
  if (!active && inMobileArea) return <Navigate to="/" replace />
  return <Outlet />
}
