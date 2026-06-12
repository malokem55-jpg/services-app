import MobileScreenHeader from '../components/MobileScreenHeader'
import PwaSettingsSection from '../components/PwaSettingsSection'

/**
 * إعدادات النسخة المخصصة: تاب PWA فقط — إلغاء تفعيل النسخة المخصصة من هنا
 * يعيد التطبيق فوراً للنسخة الكاملة (تتكفل به بوابة CustomModeGate).
 */
export default function MobileSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50/80 page-enter">
      <MobileScreenHeader title="الإعدادات" accent="bg-gray-400" />

      <main className="max-w-md mx-auto px-4 py-5 pb-10">
        <PwaSettingsSection />
      </main>
    </div>
  )
}
