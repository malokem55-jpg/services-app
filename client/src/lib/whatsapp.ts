// تحويل رقم الهاتف المحلي (05xxxxxxxx) إلى رابط محادثة واتساب بالصيغة الدولية،
// مع رسالة مسبقة التعبئة اختيارياً تظهر في حقل الكتابة جاهزة للإرسال.
// يعيد null إذا لم يوجد رقم صالح فلا يُعرض الزر أصلاً.
//
// على الجوال يُستخدم wa.me لأنه يفتح تطبيق واتساب مباشرة، أما على الكمبيوتر
// فـ wa.me يعرض صفحة وسيطة ("Open app / Continue to WhatsApp Web") لذا نوجّه
// مباشرة إلى واتساب ويب فتُفتح المحادثة فوراً والرسالة معبأة.
export function whatsappUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = '966' + digits.slice(1)
  else if (digits.startsWith('5') && digits.length === 9) digits = '966' + digits
  // بعد التطبيع يجب أن يكون الرقم دولياً معقولاً (٨ أرقام فأكثر)
  if (digits.length < 8) return null

  const text = message ? encodeURIComponent(message) : ''
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
  if (isMobile) {
    return `https://wa.me/${digits}${text ? `?text=${text}` : ''}`
  }
  return `https://web.whatsapp.com/send?phone=${digits}${text ? `&text=${text}` : ''}`
}
