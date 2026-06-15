import { useState } from 'react'

type CopyButtonProps = {
  /** القيمة التي تُنسخ إلى الحافظة */
  value: string
  /** وصف الحقل لإظهاره في tooltip و aria-label (مثال: «اسم العميل») */
  label?: string
}

/**
 * زر نسخ صغير بنفس شكل الزر الموجود بجانب اسم المؤسسة.
 * يدير حالة «تم النسخ» داخلياً ويمنع انتشار النقر حتى لا يفتح صف الجدول.
 */
export default function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* الحافظة غير متاحة — نتجاهل بصمت */
    }
  }

  const title = label ? `نسخ ${label}` : 'نسخ'

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'تم النسخ' : title}
      title={copied ? 'تم النسخ' : title}
      className="shrink-0 rounded-md p-1 text-gray-300 hover:text-sky-600 hover:bg-sky-50
                 active:text-sky-700 transition-colors"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )}
    </button>
  )
}
