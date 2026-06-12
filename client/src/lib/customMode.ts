// النسخة المخصصة تعمل حصراً في تطبيق PWA المثبت على موبايل:
// المتصفح العادي (موبايل أو دسكتوب) والـ PWA المثبت على دسكتوب يبقون بالنسخة الكاملة
export function isMobilePwa(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari على iOS لا يدعم display-mode ويوفر navigator.standalone بدلاً منه
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const mobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  return standalone && mobileDevice
}
