import type { MonthlyPaymentAlert } from '../hooks/useNotifications'

// رسالة تذكير الدفعة التي تُعبَّأ مسبقاً في محادثة واتساب مع العميل.
// مشتركة بين جرس التنبيهات في الدسكتوب وشاشة الدفعات الشهرية في الموبايل.
export function paymentReminderMessage(item: MonthlyPaymentAlert): string {
  const name = item.client?.name ?? ''
  const date = item.receivedDate ? item.receivedDate.slice(0, 10) : ''
  const carried = item.carriedOverAmount ?? 0
  const carriedFrom = item.carriedFromMonth ? item.carriedFromMonth.slice(0, 10) : ''

  // المبلغ الإجمالي يشمل القسط الأصلي + المرحّل، فنستخرج القسط الأصلي بطرح المرحّل
  if (item.amount != null && carried > 0) {
    const base = item.amount - carried
    return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date}.\nقسط الشهر: ${base} ريال بتاريخ ${date}\nمبلغ مرحّل من دفعة سابقة: ${carried} ريال بتاريخ ${carriedFrom}\nالمجموع: ${item.amount} ريال (${base} + ${carried})\nنشكر لكم تعاونكم.`
  }

  const amount = item.amount != null ? `${item.amount} ريال` : ''
  return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date} بمبلغ ${amount}.\nنشكر لكم تعاونكم.`
}
