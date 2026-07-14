import CustomMobileToggleCard from './CustomMobileToggleCard'
import MuqeemUnifiedButtonCard from './MuqeemUnifiedButtonCard'
import DeviceNotificationsCard from './DeviceNotificationsCard'

/**
 * قسم إعدادات النسخة المخصصة في شاشة /m/settings: تفعيل/تحديث إشعارات هذا الجهاز
 * (ضروري لآيفون حيث تُحصر الشاشات في /m ولا تظهر إعدادات سطح المكتب) + مفتاح النسخة
 * المخصصة + تجهيز/تحديث «زر مقيم الموحّد» (فعل صيانة نادر، منقول من شاشة مقيم اليومية).
 */
export default function PwaSettingsSection() {
  return (
    <div className="space-y-5 md:space-y-4">
      <DeviceNotificationsCard />
      <CustomMobileToggleCard />
      <MuqeemUnifiedButtonCard />
    </div>
  )
}
