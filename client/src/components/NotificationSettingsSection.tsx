import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface NotificationSchedule {
  hour: number
  minute: number
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-11'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toTimeString(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`
}

function formatTime12(hour: number, minute: number) {
  const period = hour >= 12 ? 'مساءً' : 'صباحاً'
  const h = hour % 12 || 12
  return `${pad(h)}:${pad(minute)} ${period}`
}

export default function NotificationSettingsSection() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<NotificationSchedule>({
    queryKey: ['notification-settings'],
    queryFn: () => apiFetch<NotificationSchedule>('/api/notification-settings'),
  })

  const [timeValue, setTimeValue] = useState('15:47')

  useEffect(() => {
    if (data) setTimeValue(toTimeString(data.hour, data.minute))
  }, [data])

  const mutation = useMutation({
    mutationFn: (body: { hour: number; minute: number }) =>
      apiFetch<{ ok: boolean; hour: number; minute: number }>('/api/notification-settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.setQueryData(['notification-settings'], { hour: res.hour, minute: res.minute })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const [h, m] = timeValue.split(':').map(Number)
    mutation.mutate({ hour: h, minute: m })
  }

  const [selectedHour, selectedMinute] = timeValue.split(':').map(Number)

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">ضبط الإشعارات — وقت الإرسال اليومي</h3>
        </div>

        <div className="p-5 md:p-4 space-y-5 md:space-y-4">

          {/* Current schedule display */}
          <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs text-sky-600 font-medium">الوقت الحالي للإرسال</p>
              {isLoading ? (
                <div className="h-5 w-24 rounded bg-sky-100 animate-pulse mt-0.5" />
              ) : (
                <p className="text-sm font-bold text-sky-800">
                  {data ? formatTime12(data.hour, data.minute) : '—'}
                </p>
              )}
            </div>
          </div>

          {/* Time picker form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>الوقت الجديد</label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => { setTimeValue(e.target.value); mutation.reset() }}
                required
                className={inputCls}
              />
              {timeValue && (
                <p className="text-xs text-gray-400 mt-1.5">
                  سيتم إرسال الإشعارات كل يوم الساعة {formatTime12(selectedHour, selectedMinute)}
                </p>
              )}
            </div>

            {mutation.isError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">
                  {mutation.error instanceof Error ? mutation.error.message : 'حدث خطأ'}
                </p>
              </div>
            )}

            {mutation.isSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-sm text-emerald-700 font-medium">
                  تم حفظ الوقت بنجاح — سيتم الإرسال الساعة {formatTime12(selectedHour, selectedMinute)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || isLoading}
              className="w-full md:w-auto md:px-8 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-sm font-semibold py-3 md:py-2.5 min-h-11 md:min-h-0 transition-colors
                         shadow-sm shadow-sky-500/20"
            >
              {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الوقت'}
            </button>
          </form>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">كيف تعمل الإشعارات؟</h3>
        </div>
        <div className="p-5 md:p-4">
          <ul className="space-y-3 md:space-y-2.5 text-sm text-gray-600">
            {[
              'يتم إرسال الإشعارات مرة واحدة يومياً في الوقت المحدد.',
              'يُرسَل إشعار لكل تنبيه جديد فقط (لا يتكرر الإشعار للتنبيه ذاته).',
              'يشمل ذلك: الدفعات الشهرية، الدفعات المخصصة، انتهاء الإقامات.',
              'تأكد من منح التطبيق إذن الإشعارات في متصفحك.',
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 text-xs font-bold
                                 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
