import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import CustomMobileToggleCard from './CustomMobileToggleCard'

interface PushChannels {
  pushMonthlyPayment: boolean
  pushCustomPayment: boolean
  pushIqamaSoon: boolean
  pushIqamaExpired: boolean
  pushTafweed: boolean
}

interface NotificationSettings extends PushChannels {
  hour: number
  minute: number
}

const CHANNEL_OPTIONS: { key: keyof PushChannels; label: string; accent: string }[] = [
  { key: 'pushMonthlyPayment', label: 'الدفعات الشهرية', accent: 'bg-violet-500' },
  { key: 'pushCustomPayment', label: 'الدفعات المخصصة', accent: 'bg-rose-500' },
  { key: 'pushIqamaSoon', label: 'إقامات ستنتهي قريباً', accent: 'bg-amber-500' },
  { key: 'pushIqamaExpired', label: 'إقامات منتهية أو عاجلة', accent: 'bg-red-500' },
  { key: 'pushTafweed', label: 'التفويض والتصديق', accent: 'bg-sky-500' },
]

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors min-h-10'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

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

  const { data, isLoading } = useQuery<NotificationSettings>({
    queryKey: ['notification-settings'],
    queryFn: () => apiFetch<NotificationSettings>('/api/notification-settings'),
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
      qc.setQueryData<NotificationSettings>(['notification-settings'], (prev) =>
        prev ? { ...prev, hour: res.hour, minute: res.minute } : prev,
      )
    },
  })

  // تشغيل/إيقاف إرسال كل نوع من التنبيهات الخمسة للهاتف — تحديث متفائل
  const channelMutation = useMutation({
    mutationFn: (patch: Partial<PushChannels>) =>
      apiFetch<NotificationSettings>('/api/notification-settings/channels', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['notification-settings'] })
      const prev = qc.getQueryData<NotificationSettings>(['notification-settings'])
      if (prev) qc.setQueryData<NotificationSettings>(['notification-settings'], { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notification-settings'], ctx.prev)
    },
    onSuccess: (settings) => {
      qc.setQueryData(['notification-settings'], settings)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const [h, m] = timeValue.split(':').map(Number)
    mutation.mutate({ hour: h, minute: m })
  }

  function toggleChannel(key: keyof PushChannels, checked: boolean) {
    channelMutation.mutate({ [key]: checked })
  }

  const [selectedHour, selectedMinute] = timeValue.split(':').map(Number)

  return (
    <div className="space-y-3 md:space-y-4">
      {/* مفتاح نسخة الموبايل المخصصة (مصغّر، منقول من تاب «تطبيق الموبايل») */}
      <CustomMobileToggleCard />

      <div className="grid md:grid-cols-2 gap-3 md:gap-4 items-stretch">
      {/* اختيار التنبيهات المُرسَلة للهاتف */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">التنبيهات المُرسَلة للهاتف</h3>
        </div>

        {isLoading ? (
          <div className="px-3 py-1.5 flex-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
                <div className="flex-1" />
                <div className="w-4 h-4 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2 py-1 flex-1">
            {CHANNEL_OPTIONS.map(({ key, label, accent }) => (
              <label
                key={key}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg
                           cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${accent}`} />
                <span className="flex-1 text-[13px] font-medium text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  checked={data?.[key] ?? true}
                  disabled={channelMutation.isPending}
                  onChange={(e) => toggleChannel(key, e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-gray-300 cursor-pointer
                             disabled:opacity-50 accent-sky-600"
                />
              </label>
            ))}
          </div>
        )}

      </div>

      {/* وقت الإرسال اليومي */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">وقت الإرسال اليومي</h3>
        </div>

        <div className="p-3 space-y-3 flex flex-col flex-1">

          {/* Current schedule display */}
          <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0">
              <p className="text-[11px] text-sky-600 font-medium leading-none">الوقت الحالي</p>
              {isLoading ? (
                <div className="h-4 w-20 rounded bg-sky-100 animate-pulse mt-1" />
              ) : (
                <p className="text-sm font-bold text-sky-800 mt-0.5 leading-none">
                  {data ? formatTime12(data.hour, data.minute) : '—'}
                </p>
              )}
            </div>
          </div>

          {/* Time picker form */}
          <form onSubmit={handleSubmit} className="space-y-2.5 flex flex-col flex-1">
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
                <p className="text-[11px] text-gray-400 mt-1">
                  يُرسَل كل يوم الساعة {formatTime12(selectedHour, selectedMinute)}
                </p>
              )}
            </div>

            {mutation.isError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-xs text-red-700">
                  {mutation.error instanceof Error ? mutation.error.message : 'حدث خطأ'}
                </p>
              </div>
            )}

            {mutation.isSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-xs text-emerald-700 font-medium">
                  تم حفظ الوقت — الإرسال {formatTime12(selectedHour, selectedMinute)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || isLoading}
              className="w-full rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                         text-white text-[13px] font-semibold py-2 min-h-10 transition-colors
                         shadow-sm shadow-sky-500/20 mt-auto"
            >
              {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الوقت'}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}
