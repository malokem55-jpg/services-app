import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import MuqeemFillCard from '../MuqeemFillCard'
import SendNotificationsNowCard from './SendNotificationsNowCard'

// قسم «تشغيل المشروع على الهاتف» داخل لوحة malik.
// يقرأ ويبدّل إعداد runOnMobile عبر نقطة عامة بلا مصادقة حتى تعمل اللوحة بلا تسجيل دخول.

interface MobileAccess {
  runOnMobile: boolean
}

export default function MobileAccessSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<MobileAccess>({
    queryKey: ['mobile-access'],
    queryFn: () => apiFetch<MobileAccess>('/api/ui-settings/mobile-access'),
  })

  const mutation = useMutation({
    mutationFn: (runOnMobile: boolean) =>
      apiFetch<MobileAccess>('/api/ui-settings/mobile-access', {
        method: 'PUT',
        body: JSON.stringify({ runOnMobile }),
      }),
    onSuccess: (d) => qc.setQueryData(['mobile-access'], d),
  })

  const enabled = data?.runOnMobile === true

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 page-enter">
      <div>
        <h2 className="text-xl font-bold text-gray-900">تشغيل المشروع على الهاتف</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          تحكّم بفتح الموقع على الأجهزة المحمولة
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5">
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <label
            className="flex items-center gap-3 px-5 py-4 md:py-3 cursor-pointer
                       hover:bg-gray-50/60 transition-colors"
          >
            <span className={`w-1.5 h-9 md:h-8 rounded-full shrink-0 ${enabled ? 'bg-sky-500' : 'bg-gray-300'}`} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-800">
                تشغيل المشروع على الهاتف
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">
                {enabled
                  ? 'الموقع يعمل على متصفحات الجوال وتطبيق الهاتف'
                  : 'الموقع يعمل على الكمبيوتر فقط، وممنوع على الهاتف'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={mutation.isPending}
              onChange={(e) => mutation.mutate(e.target.checked)}
              className="w-5 h-5 shrink-0 rounded border-gray-300 text-sky-600
                         focus:ring-2 focus:ring-sky-500 cursor-pointer disabled:opacity-50 accent-sky-600"
            />
          </label>
        )}

        {mutation.isError && (
          <p className="px-5 pb-4 text-sm text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : 'تعذّر حفظ التغيير'}
          </p>
        )}
      </div>

      {/* تعبئة مقيم على الآيفون (منقول من تاب «تطبيق الموبايل») */}
      <MuqeemFillCard />

      {/* إرسال جميع التنبيهات الآن (منقول من تاب «ضبط الجوال» في الإعدادات) */}
      <SendNotificationsNowCard />

      {/* شرح آلية عمل الإشعارات (منقول من تاب «ضبط الجوال» في الإعدادات) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-sky-700">كيف تعمل الإشعارات؟</h3>
        </div>
        <div className="p-4">
          <ul className="space-y-2.5 text-xs leading-relaxed text-gray-600">
            {[
              'يتم إرسال الإشعارات مرة واحدة يومياً في الوقت المحدد.',
              'يُرسَل إشعار لكل تنبيه جديد فقط (لا يتكرر للتنبيه ذاته).',
              'يُرسَل إشعار فقط للتنبيهات التي فعّلتها في إعدادات التطبيق.',
              'زر «إرسال جميع التنبيهات الآن» يُعيد الإرسال فوراً حتى لو سبق إرساله.',
              'تأكد من منح التطبيق إذن الإشعارات في متصفحك.',
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-600 text-[10px] font-bold
                                 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
