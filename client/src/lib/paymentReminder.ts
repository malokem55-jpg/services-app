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

// رسالة مجمَّعة لعميل عليه عدة دفعات: تسرد كل دفعة بتاريخها ومبلغها ثم الإجمالي.
// الدفعة التي تشمل مبلغاً مرحّلاً تُوضَّح في سطرها.
export function paymentReminderMessageGrouped(items: MonthlyPaymentAlert[]): string {
  const name = items[0]?.client?.name ?? ''
  const lines = items.map((it) => {
    const date = it.receivedDate ? it.receivedDate.slice(0, 10) : ''
    const amount = it.amount ?? 0
    const carried = it.carriedOverAmount ?? 0
    const carriedFrom = it.carriedFromMonth ? it.carriedFromMonth.slice(0, 10) : ''
    const note = carried > 0 ? ` (تشمل ${carried} مرحّلة من دفعة ${carriedFrom})` : ''
    return `• ${date} : ${amount} ريال${note}`
  })
  const total = items.reduce((s, it) => s + (it.amount ?? 0), 0)
  return `السلام عليكم ${name}،\nنذكّركم بدفعاتكم الشهرية المستحقة:\n\n${lines.join('\n')}\n\nالإجمالي: ${total.toLocaleString('en-US')} ريال\nنشكر لكم تعاونكم.`
}

// تختار الرسالة المناسبة: المفردة لدفعة واحدة، والمجمَّعة لأكثر من دفعة.
export function groupReminderMessage(items: MonthlyPaymentAlert[]): string {
  return items.length === 1 ? paymentReminderMessage(items[0]) : paymentReminderMessageGrouped(items)
}
