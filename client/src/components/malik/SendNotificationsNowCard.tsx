import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

// كرت «إرسال جميع التنبيهات الآن» داخل لوحة malik (منقول من تاب ضبط الجوال في الإعدادات).
// يُرسل فوراً كل التنبيهات المُفعَّلة حتى لو سبق إرسالها. النقطة تقبل كلمة مرور اللوحة.
export default function SendNotificationsNowCard() {
  const sendNowMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/api/notification-settings/send-now', { method: 'POST' }),
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-sky-700">إرسال التنبيهات</h3>
      </div>
      <div className="p-4 space-y-2">
        <button
          type="button"
          onClick={() => { sendNowMutation.reset(); sendNowMutation.mutate() }}
          disabled={sendNowMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-xl
                     bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                     text-white text-sm font-semibold py-2.5 min-h-11 transition-colors
                     shadow-sm shadow-emerald-500/20"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 5.45a.5.5 0 01.67-.65l16.5 7.2a.5.5 0 010 .9l-16.5 7.2a.5.5 0 01-.67-.65L6 12zm0 0h6" />
          </svg>
          {sendNowMutation.isPending ? 'جارٍ الإرسال...' : 'إرسال جميع التنبيهات الآن'}
        </button>

        {sendNowMutation.isError ? (
          <p className="text-xs text-red-600 text-center">
            {sendNowMutation.error instanceof Error ? sendNowMutation.error.message : 'تعذّر الإرسال'}
          </p>
        ) : sendNowMutation.isSuccess ? (
          <p className="text-xs text-emerald-600 font-medium text-center">تم إرسال التنبيهات بنجاح ✓</p>
        ) : (
          <p className="text-xs text-gray-400 text-center">يُرسِل التنبيهات المُفعَّلة فوراً حتى لو سبق إرسالها</p>
        )}
      </div>
    </div>
  )
}
