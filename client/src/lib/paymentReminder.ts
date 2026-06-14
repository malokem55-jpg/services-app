import type { MonthlyPaymentAlert } from '../hooks/useNotifications'

// رسالة تذكير الدفعة التي تُعبَّأ مسبقاً في محادثة واتساب مع العميل.
// مشتركة بين جرس التنبيهات في الدسكتوب وشاشة الدفعات الشهرية في الموبايل.
export function paymentReminderMessage(item: MonthlyPaymentAlert): string {
  const name = item.client?.name ?? ''
  const amount = item.amount != null ? `${item.amount} ريال` : ''
  const date = item.receivedDate ? item.receivedDate.slice(0, 10) : ''
  return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date} بمبلغ ${amount}.\nنشكر لكم تعاونكم.`
}
