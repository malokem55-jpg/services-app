import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import TabBar from '../components/TabBar'
import ArrivalPlacesSection from '../components/ArrivalPlacesSection'
import NotificationSettingsSection from '../components/NotificationSettingsSection'
import { apiFetch } from '../lib/api'
import { useUiSettings } from '../hooks/useUiSettings'
import type { UiSettings } from '../hooks/useUiSettings'

type SettingsTab = 'bells' | 'pages' | 'places' | 'push'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'push', label: 'ضبط الجوال' },
  { id: 'pages', label: 'الصفحات' },
  { id: 'bells', label: 'التنبيهات' },
  { id: 'places', label: 'جهات القدوم' },
]

const BELL_OPTIONS: { key: keyof UiSettings; label: string; description: string; accent: string }[] = [
  {
    key: 'showBellCustomPayments',
    label: 'تنبيهات الدفعيات المخصصة',
    description: 'جرس الدفعيات المخصصة القادمة',
    accent: 'bg-red-500',
  },
  {
    key: 'showBellMonthlyPayments',
    label: 'تنبيهات الدفعيات الشهرية',
    description: 'جرس الدفعيات الشهرية القادمة',
    accent: 'bg-violet-500',
  },
  {
    key: 'showBellIqamaSoon',
    label: 'تنبيهات الاقامات قبل 30 يوم',
    description: 'جرس الإقامات التي ستنتهي قريباً',
    accent: 'bg-amber-500',
  },
  {
    key: 'showBellIqamaExpired',
    label: 'تنبيهات الاقامات المنتهية',
    description: 'جرس الإقامات المنتهية',
    accent: 'bg-red-500',
  },
  {
    key: 'showBellTafweed',
    label: 'تنبيهات التفويض والتصديق',
    description: 'جرس تنبيهات تاريخ التفويض',
    accent: 'bg-orange-500',
  },
]

const PAGE_OPTIONS: { key: keyof UiSettings; label: string; description: string; accent: string }[] = [
  {
    key: 'showUnderProcedurePage',
    label: 'صفحة العملاء تحت الإجراء',
    description: 'تظهر في القائمة وكرتها في لوحة التحكم',
    accent: 'bg-amber-500',
  },
  {
    key: 'showIqamaAlertsPage',
    label: 'صفحة عملاء تنبيهات الإقامات',
    description: 'تحل محل جرسي تنبيهات الإقامات',
    accent: 'bg-orange-500',
  },
  {
    key: 'showDeletedDuesPage',
    label: 'صفحة ديون المحذوفين',
    description: 'تظهر في القائمة وكرتها في لوحة التحكم',
    accent: 'bg-red-500',
  },
]

interface OptionRowProps {
  label: string
  description: string
  accent: string
  checked: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
}

function OptionRow({ label, description, accent, checked, disabled, onToggle }: OptionRowProps) {
  return (
    <label
      className="flex items-center gap-3 px-5 py-4 md:py-3 border-b border-gray-50 last:border-0
                 cursor-pointer hover:bg-gray-50/60 transition-colors"
    >
      <span className={`w-1.5 h-9 md:h-8 rounded-full shrink-0 ${accent}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-5 h-5 shrink-0 rounded border-gray-300 text-sky-600
                   focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-50 accent-sky-600"
      />
    </label>
  )
}

function SectionSkeleton() {
  return (
    <div className="p-5 space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-1.5 h-9 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-56 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: settings, isLoading, isError } = useUiSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('push')

  const mutation = useMutation({
    mutationFn: (patch: Partial<UiSettings>) =>
      apiFetch<UiSettings>('/api/ui-settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    // تحديث متفائل: يظهر أثر التغيير فوراً ويُتراجع عنه عند الفشل
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['ui-settings'] })
      const prev = qc.getQueryData<UiSettings>(['ui-settings'])
      if (prev) qc.setQueryData<UiSettings>(['ui-settings'], { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ui-settings'], ctx.prev)
    },
    onSuccess: (data) => {
      qc.setQueryData(['ui-settings'], data)
    },
  })

  function toggle(key: keyof UiSettings, checked: boolean) {
    mutation.mutate({ [key]: checked })
  }

  // صفحة عملاء تنبيهات الإقامات تحل محل جرسي الإقامات: ما دامت ظاهرة يُقفل الجرسان مخفيين
  const iqamaPageVisible = settings?.showIqamaAlertsPage === true

  function renderSection(
    title: string,
    subtitle: string,
    options: typeof BELL_OPTIONS,
  ) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>

        {isLoading ? (
          <SectionSkeleton />
        ) : (
          options.map(({ key, label, description, accent }) => {
            const lockedByIqamaPage =
              iqamaPageVisible && (key === 'showBellIqamaSoon' || key === 'showBellIqamaExpired')
            return (
              <OptionRow
                key={key}
                label={label}
                description={lockedByIqamaPage
                  ? 'مخفي تلقائياً لأن صفحة تنبيهات الإقامات ظاهرة'
                  : description}
                accent={accent}
                checked={lockedByIqamaPage
                  ? false
                  : settings?.[key] ?? (key === 'showIqamaAlertsPage' ? false : true)}
                disabled={mutation.isPending || lockedByIqamaPage}
                onToggle={(checked) => toggle(key, checked)}
              />
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 md:space-y-4 page-enter">
        <div>
          <h2 className="text-xl font-bold text-gray-900">الإعدادات</h2>
          <p className="text-sm text-gray-500 mt-0.5">تخصيص الصفحات والتنبيهات والتطبيق</p>
        </div>

        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} ariaLabel="أقسام الإعدادات" />

        {isError && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd" />
            </svg>
            تعذّر تحميل الإعدادات، حاول تحديث الصفحة.
          </div>
        )}

        {mutation.isError && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd" />
            </svg>
            {mutation.error instanceof Error ? mutation.error.message : 'تعذّر حفظ التغيير'}
          </div>
        )}

        {activeTab === 'bells' &&
          renderSection('التنبيهات', 'التحكم في إظهار وإخفاء أجراس التنبيهات الخمسة', BELL_OPTIONS)}
        {activeTab === 'pages' &&
          renderSection('الصفحات', 'الصفحة المخفية تختفي من القائمة ومن لوحة التحكم', PAGE_OPTIONS)}
        {activeTab === 'places' && <ArrivalPlacesSection />}
        {activeTab === 'push' && <NotificationSettingsSection />}
      </main>
    </div>
  )
}
