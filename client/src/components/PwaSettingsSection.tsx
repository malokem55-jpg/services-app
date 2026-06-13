import CustomMobileToggleCard from './CustomMobileToggleCard'
import MuqeemFillCard from './MuqeemFillCard'

/**
 * قسم إعدادات النسخة المخصصة في شاشة /m/settings: مفتاح النسخة المخصصة + «الزر السحري»
 * لتعبئة بيانات مقيم على الآيفون. الكرتان مكوّنان مستقلان يُعاد استخدامهما في أماكن أخرى
 * (تاب اشعارات الهاتف، ولوحة malik) بعد إعادة التوزيع.
 */
export default function PwaSettingsSection() {
  return (
    <div className="space-y-5 md:space-y-4">
      <CustomMobileToggleCard />
      <MuqeemFillCard />
    </div>
  )
}
