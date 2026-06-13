import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useUiSettings } from '../hooks/useUiSettings'
import type { UiSettings } from '../hooks/useUiSettings'

// كرت مفتاح «نسخة الموبايل المخصصة» (showCustomMobileVersion) — نسخة مدمجة بصف واحد
// بلا ترويسة منفصلة. يُعاد استخدامه في تاب «اشعارات الهاتف» وفي شاشة /m/settings.
export default function CustomMobileToggleCard() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useUiSettings()

  const mutation = useMutation({
    mutationFn: (patch: Partial<UiSettings>) =>
      apiFetch<UiSettings>('/api/ui-settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => qc.setQueryData(['ui-settings'], data),
  })

  const enabled = settings?.showCustomMobileVersion === true

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {isLoading ? (
        <div className="p-3">
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors">
          <span className={`w-1.5 h-9 rounded-full shrink-0 ${enabled ? 'bg-sky-500' : 'bg-gray-300'}`} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-800">نسخة الموبايل المخصصة</span>
            <span className="block text-xs text-gray-400 mt-0.5">عند الإيقاف يظهر الموقع الكامل في التطبيق</span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate({ showCustomMobileVersion: e.target.checked })}
            className="w-5 h-5 shrink-0 rounded border-gray-300 text-sky-600
                       focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-50 accent-sky-600"
          />
        </label>
      )}

      {mutation.isError && (
        <p className="px-4 pb-3 text-sm text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : 'تعذّر حفظ التغيير'}
        </p>
      )}
    </div>
  )
}
