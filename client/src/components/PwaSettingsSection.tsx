import CustomMobileToggleCard from './CustomMobileToggleCard'

/**
 * قسم إعدادات النسخة المخصصة في شاشة /m/settings: مفتاح النسخة المخصصة.
 * (تعبئة مقيم انتقلت لشاشة /m/muqeem نفسها عبر «الزر الموحّد».)
 */
export default function PwaSettingsSection() {
  return (
    <div className="space-y-5 md:space-y-4">
      <CustomMobileToggleCard />
    </div>
  )
}
