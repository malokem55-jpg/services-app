import CustomMobileToggleCard from './CustomMobileToggleCard'
import MuqeemUnifiedButtonCard from './MuqeemUnifiedButtonCard'

/**
 * قسم إعدادات النسخة المخصصة في شاشة /m/settings: مفتاح النسخة المخصصة + تجهيز/تحديث
 * «زر مقيم الموحّد» (فعل صيانة نادر، منقول من شاشة مقيم اليومية).
 */
export default function PwaSettingsSection() {
  return (
    <div className="space-y-5 md:space-y-4">
      <CustomMobileToggleCard />
      <MuqeemUnifiedButtonCard />
    </div>
  )
}
