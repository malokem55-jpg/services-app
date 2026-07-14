import { useRegisterSW } from 'virtual:pwa-register/react'
import { isMobilePwa } from '../lib/customMode'

// شريط يظهر أعلى الشاشة فقط عندما تتوفّر نسخة أحدث من التطبيق.
// بضغطة «تحديث الآن» تُفعَّل النسخة الجديدة وتُعاد الصفحة تلقائياً بالبيانات المحدَّثة.
// يظهر حصراً في تطبيق PWA المثبت على الموبايل — نسخة الدسكتوب/الويب تُحدَّث بتحديث
// المتصفح العادي فلا تحتاجه.
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh || !isMobilePwa()) return null

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[70] bg-emerald-600 text-white text-sm
                 flex items-center justify-center gap-3
                 pb-2 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
    >
      <span className="font-semibold">يتوفّر تحديث جديد</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-emerald-700
                   transition active:scale-95"
      >
        تحديث الآن
      </button>
    </div>
  )
}

export default UpdatePrompt
