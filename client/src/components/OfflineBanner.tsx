import { useOnlineStatus } from '../hooks/useOnlineStatus'

// شريط يظهر أعلى الشاشة فور انقطاع الإنترنت ويختفي عند عودته
function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-sm font-semibold
                 text-center pb-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)]"
    >
      لا يوجد اتصال بالإنترنت
    </div>
  )
}

export default OfflineBanner
